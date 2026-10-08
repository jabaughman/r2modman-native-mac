const { contextBridge, ipcRenderer } = require('electron');

const dialogs = Object.freeze({
    selectFile: options => ipcRenderer.invoke('desktop:select-file', options),
    selectFolder: options => ipcRenderer.invoke('desktop:select-folder', options)
});

if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('r2modmanDialogs', dialogs);
} else {
    // Transitional compatibility until the remaining renderer Node dependencies move.
    Object.defineProperty(window, 'r2modmanDialogs', { value: dialogs, writable: false, configurable: false });
}
