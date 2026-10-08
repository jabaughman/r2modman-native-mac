import { ipcMain, dialog, clipboard, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import os from 'os';
import { registerProfileConfigHandlers } from './profileConfigHandlers';
import { registerProfileLogHandlers } from './profileLogHandlers';
import { registerShellHandlers } from './shellHandlers';
import { registerDialogHandlers } from './dialogHandlers';
import { registerLifecycleHandlers } from './lifecycleHandlers';

let browserWindow;
let app;

export default class Listeners {
    constructor(window, electronApp) {
        browserWindow = window;
        app = electronApp;
    }
}

function isPortable() {
    if (process.platform === 'win32') return process.execPath.startsWith(os.tmpdir());
    // Preserve the existing Linux interpretation until Manager.vue is refactored.
    if (process.platform === 'linux') return typeof process.env.APPIMAGE === 'undefined';
    return false;
}

function prepareUpdates() {
    // Locally hardened macOS builds must not be replaced by an unreviewed updater.
    if (process.platform === 'darwin') return;
    if (typeof process.env.APPIMAGE !== 'undefined' || !process.execPath.startsWith(os.tmpdir())) {
        autoUpdater.autoDownload = true;
        // This acknowledges setup, as the legacy update-done signal did; it does
        // not wait for a download or block catalog loading on a failed check.
        try {
            Promise.resolve(autoUpdater.checkForUpdatesAndNotify()).catch(error => console.error('Update check failed', error));
        } catch (error) { console.error('Update check failed', error); }
    }
}

registerDialogHandlers(ipcMain, dialog, () => browserWindow, process.env.APP_URL);
export const forwardInstallRequest = registerLifecycleHandlers(ipcMain, {
    get app() { return app; }, clipboard, isPortable, prepareUpdates
}, () => browserWindow, process.env.APP_URL);

registerShellHandlers(ipcMain, shell, () => browserWindow, process.env.APP_URL);

const profileFiles = registerProfileLogHandlers(ipcMain, {
    clipboard
}, () => browserWindow, process.env.APP_URL);

registerProfileConfigHandlers(ipcMain, profileFiles, () => browserWindow, process.env.APP_URL);
