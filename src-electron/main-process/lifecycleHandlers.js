const { authorizeSender, trustedWindow } = require('./trustedSender');

function isInstallProtocol(value) {
    return typeof value === 'string' && value.length <= 8192 && !/[\r\n\0]/.test(value)
        && /^ror2mm:\/\/v1\/install\/(?:[a-zA-Z0-9]+\.)?thunderstore\.io\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+\/\d+\.\d+\.\d+\/?$/.test(value);
}

function registerLifecycleHandlers(ipcMain, services, getWindow, appUrl) {
    const handle = (channel, action) => ipcMain.handle(channel, (event, ...args) => {
        authorizeSender(event, getWindow, appUrl);
        return action(...args);
    });
    handle('desktop:get-startup-info', () => ({ appData: services.app.getPath('appData'), isPortable: services.isPortable() }));
    handle('desktop:prepare-updates', () => services.prepareUpdates());
    handle('desktop:copy-text', value => {
        if (typeof value !== 'string' || value.length > 16 * 1024 * 1024) throw new Error('Invalid clipboard text');
        services.clipboard.writeText(value);
    });
    handle('desktop:restart', () => {
        services.app.relaunch();
        services.app.exit();
    });
    // Called only by the main-process protocol transport, never by renderer IPC.
    return value => {
        if (!isInstallProtocol(value)) return false;
        try {
            trustedWindow(getWindow, appUrl).webContents.send('desktop:install-request', value);
            return true;
        } catch (_) { return false; }
    };
}

module.exports = { registerLifecycleHandlers, isInstallProtocol };
