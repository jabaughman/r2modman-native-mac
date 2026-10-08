const { contextBridge, ipcRenderer } = require('electron');

const dialogs = Object.freeze({
    selectFile: options => ipcRenderer.invoke('desktop:select-file', options),
    selectFolder: options => ipcRenderer.invoke('desktop:select-folder', options)
});

const desktop = Object.freeze({
    getStartupInfo: () => ipcRenderer.invoke('desktop:get-startup-info'),
    prepareUpdates: () => ipcRenderer.invoke('desktop:prepare-updates'),
    copyText: value => ipcRenderer.invoke('desktop:copy-text', value),
    restart: () => ipcRenderer.invoke('desktop:restart'),
    onInstallRequest: callback => {
        if (typeof callback !== 'function') throw new Error('Invalid install callback');
        const listener = (_event, value) => {
            if (typeof value === 'string') callback(value);
        };
        ipcRenderer.on('desktop:install-request', listener);
        return () => ipcRenderer.removeListener('desktop:install-request', listener);
    }
});

for (const [name, api] of [['r2modmanDialogs', dialogs], ['r2modmanDesktop', desktop]]) {
    if (process.contextIsolated) {
        contextBridge.exposeInMainWorld(name, api);
    } else {
        // Transitional compatibility until the remaining renderer Node dependencies move.
        Object.defineProperty(window, name, { value: api, writable: false, configurable: false });
    }
}
