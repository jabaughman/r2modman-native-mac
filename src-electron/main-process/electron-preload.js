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

const shell = Object.freeze({
    openExternal: url => ipcRenderer.invoke('desktop:open-external', url),
    openLocal: path => ipcRenderer.invoke('desktop:open-local', path),
    revealLocal: path => ipcRenderer.invoke('desktop:reveal-local', path),
    verifySteam: identifier => ipcRenderer.invoke('desktop:verify-steam', identifier),
    launchEpic: identifier => ipcRenderer.invoke('desktop:launch-epic', identifier)
});

const profileLogs = Object.freeze({
    setDataRoot: root => ipcRenderer.invoke('desktop:set-log-data-root', root),
    exists: scope => ipcRenderer.invoke('desktop:profile-log-exists', scope),
    copy: scope => ipcRenderer.invoke('desktop:copy-profile-log', scope)
});

const profileConfigs = Object.freeze({
    list: scope => ipcRenderer.invoke('desktop:list-profile-configs', scope)
});

for (const [name, api] of [['r2modmanDialogs', dialogs], ['r2modmanDesktop', desktop], ['r2modmanShell', shell], ['r2modmanProfileLogs', profileLogs], ['r2modmanProfileConfigs', profileConfigs]]) {
    if (process.contextIsolated) {
        contextBridge.exposeInMainWorld(name, api);
    } else {
        // Transitional compatibility until the remaining renderer Node dependencies move.
        Object.defineProperty(window, name, { value: api, writable: false, configurable: false });
    }
}
