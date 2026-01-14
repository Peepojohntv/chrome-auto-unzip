// JSZip laden (muss als jszip.min.js im gleichen Ordner liegen)
importScripts('jszip.min.js');

const defaultSettings = {
  enabled: true,      // automatisch entpacken
  keepFolders: false, // Ordner aus ZIP behalten?
  deleteZip: false    // Original-ZIP löschen?
};

function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(defaultSettings, resolve);
  });
}

// Blob -> data:URL (statt URL.createObjectURL)
async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mime = blob.type || "application/octet-stream";
  return `data:${mime};base64,${base64}`;
}

// Wird aufgerufen, wenn ein Download seinen Status ändert
chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state || delta.state.current !== 'complete') return;

  handleDownloadComplete(delta.id).catch(err => {
    console.error('Fehler beim automatischen Entpacken:', err);
  });
});

async function handleDownloadComplete(downloadId) {
  const settings = await getSettings();
  if (!settings.enabled) return; // ausgeschaltet -> nichts tun

  const [item] = await chrome.downloads.search({ id: downloadId });
  if (!item || !item.filename) return;

  // Nur .zip-Dateien behandeln
  if (!/\.zip$/i.test(item.filename)) return;

  console.log('ZIP-Download erkannt:', item.filename);

  // Lokalen Pfad (z.B. C:\Users\Name\Downloads\96193.zip) in file:// URL umwandeln
  let path = item.filename.replace(/\\/g, '/'); // Backslashes -> Slashes
  if (!path.startsWith('/')) {
    path = '/' + path; // daraus wird /C:/Users/...
  }
  const fileUrl = 'file://' + path; // file:///C:/Users/...

  console.log('Lese lokale Datei:', fileUrl);

  const response = await fetch(fileUrl);
  if (!response.ok) {
    console.error('Konnte ZIP nicht von lokaler Datei lesen:', response.status, response.statusText);
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Alle Dateien in der ZIP durchgehen
  for (const [relativePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue; // Ordner überspringen

    const blob = await entry.async('blob');
    const dataUrl = await blobToDataUrl(blob); // Data-URL statt createObjectURL

    // Pfad normalisieren
    let safePath = relativePath
      .replace(/^[/\\]+/, '')   // führende / oder \ weg
      .replace(/\\/g, '/');     // Backslashes in Slashes

    let filename;
    if (settings.keepFolders) {
      // Ordner-Struktur aus der ZIP beibehalten
      filename = safePath;      // z.B. "ordner/datei.txt"
    } else {
      // Nur Dateiname, alles direkt in den Download-Ordner
      filename = safePath.split('/').pop();
    }

    console.log('Entpacke Datei:', filename);

    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,        // relativ zum Download-Ordner
      saveAs: false,
      conflictAction: 'uniquify' // bei Kollision: Datei (1).txt usw.
    });
  }

  // Original-ZIP ggf. löschen
  if (settings.deleteZip) {
    chrome.downloads.removeFile(downloadId, () => {
      if (chrome.runtime.lastError) {
        console.warn('ZIP-Datei konnte nicht gelöscht werden:', chrome.runtime.lastError.message);
      }
      chrome.downloads.erase({ id: downloadId });
    });
  }
}