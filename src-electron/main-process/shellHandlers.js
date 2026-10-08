const fs = require('fs').promises;
const path = require('path');
const { authorizeSender } = require('./trustedSender');
const CONFIG_EXTENSIONS = new Set(['.cfg', '.txt', '.json', '.yml', '.yaml', '.ini']);

function text(value) {
    if (typeof value !== 'string' || !value || value.length > 32768 || /[\0\r\n]/.test(value)) throw new Error('Invalid shell target');
    return value;
}

function externalUrl(value) {
    const url = new URL(text(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsupported external URL');
    return url.href;
}

function epicUrl(identifier) {
    if (!/^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+){0,2}$/.test(text(identifier))) throw new Error('Invalid Epic identifier');
    return `com.epicgames.launcher://apps/${identifier}?action=launch&silent=true`;
}

async function localPath(value, open) {
    text(value);
    if (!path.isAbsolute(value)) throw new Error('Expected an absolute local path');
    const real = await fs.realpath(value);
    const stat = await fs.stat(real);
    if (open && !stat.isDirectory() && !(stat.isFile() && CONFIG_EXTENSIONS.has(path.extname(real).toLowerCase()))) {
        throw new Error('Only folders and supported configuration files can be opened');
    }
    return real;
}

function registerShellHandlers(ipcMain, shell, getWindow, appUrl) {
    const handle = (channel, action) => ipcMain.handle(channel, (event, value) => {
        authorizeSender(event, getWindow, appUrl);
        return action(value);
    });
    handle('desktop:open-external', value => shell.openExternal(externalUrl(value)));
    handle('desktop:open-local', async value => {
        const error = await shell.openPath(await localPath(value, true));
        if (error) throw new Error(error);
    });
    handle('desktop:reveal-local', async value => shell.showItemInFolder(await localPath(value, false)));
    handle('desktop:verify-steam', value => {
        if (!/^\d+$/.test(text(value))) throw new Error('Invalid Steam identifier');
        return shell.openExternal(`steam://validate/${value}`);
    });
    handle('desktop:launch-epic', value => shell.openExternal(epicUrl(value)));
}

module.exports = { registerShellHandlers, externalUrl, epicUrl };
