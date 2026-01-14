const defaultSettings = {
  enabled: true,
  keepFolders: false,
  deleteZip: false
};

document.addEventListener('DOMContentLoaded', () => {
  const enabledEl = document.getElementById('enabled');
  const keepFoldersEl = document.getElementById('keepFolders');
  const deleteZipEl = document.getElementById('deleteZip');
  const saveBtn = document.getElementById('save');
  const statusEl = document.getElementById('status');

  // Aktuelle Einstellungen laden
  chrome.storage.sync.get(defaultSettings, (items) => {
    enabledEl.checked = items.enabled;
    keepFoldersEl.checked = items.keepFolders;
    deleteZipEl.checked = items.deleteZip;
  });

  // Speichern-Button
  saveBtn.addEventListener('click', () => {
    const newSettings = {
      enabled: enabledEl.checked,
      keepFolders: keepFoldersEl.checked,
      deleteZip: deleteZipEl.checked
    };

    chrome.storage.sync.set(newSettings, () => {
      statusEl.textContent = 'Gespeichert';
      setTimeout(() => statusEl.textContent = '', 1500);
    });
  });
});