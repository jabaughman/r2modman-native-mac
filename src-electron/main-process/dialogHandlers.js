// Narrow, validated main-process API; no arbitrary IPC channels or dialog properties.
function validateOptions(options, kind) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Invalid dialog options');
    const result = { properties: [kind === 'folder' ? 'openDirectory' : 'openFile', 'showHiddenFiles'] };
    for (const key of ['title', 'buttonLabel', 'defaultPath']) {
        if (options[key] !== undefined) {
            if (typeof options[key] !== 'string' || options[key].length > 32768 || options[key].includes('\0')) throw new Error('Invalid dialog text');
            result[key] = options[key];
        }
    }
    if (kind === 'file' && options.filters !== undefined) {
        if (!Array.isArray(options.filters) || options.filters.length > 100) throw new Error('Invalid file filters');
        result.filters = options.filters.map(filter => {
            if (!filter || typeof filter.name !== 'string' || filter.name.length > 1024 || !Array.isArray(filter.extensions)
                || filter.extensions.length > 100 || !filter.extensions.every(extension => typeof extension === 'string' && /^(\*|[A-Za-z0-9_-]+)$/.test(extension))) {
                throw new Error('Invalid file filter');
            }
            return { name: filter.name, extensions: [...filter.extensions] };
        });
    }
    return result;
}

function registerDialogHandlers(ipcMain, dialog, getWindow, appUrl) {
    for (const kind of ['file', 'folder']) {
        ipcMain.handle(`desktop:select-${kind}`, async (event, options) => {
            const window = getWindow();
            const frame = event.senderFrame;
            if (!window || window.isDestroyed() || event.sender !== window.webContents || !frame
                || frame !== window.webContents.mainFrame
                || frame.url.split('#')[0] !== appUrl.split('#')[0]) throw new Error('Untrusted dialog sender');
            const result = await dialog.showOpenDialog(window, validateOptions(options, kind));
            return result.canceled ? [] : result.filePaths;
        });
    }
}

module.exports = { registerDialogHandlers, validateOptions };
