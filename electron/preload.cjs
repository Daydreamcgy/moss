const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moss', {
  desktop: true,
  setTheme: (payload) => ipcRenderer.send('moss:theme', payload),
  onBeforeClose: (callback) => {
    ipcRenderer.on('moss:before-close', () => callback());
  },
  closeResponse: (dirtyCount, text) => ipcRenderer.send('moss:close-response', dirtyCount, text),
  takeStartupFile: () => ipcRenderer.invoke('moss:take-startup-file'),
  onOpenFile: (callback) => {
    ipcRenderer.on('moss:open-file', (_event, doc) => callback(doc));
  },
  saveFile: (filePath, text) => ipcRenderer.invoke('moss:save-file', filePath, text),
});
