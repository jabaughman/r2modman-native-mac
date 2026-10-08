const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { registerDialogHandlers, validateOptions } = require('../../src-electron/main-process/dialogHandlers');
(async () => {
    const handlers = new Map();
    const frame = { url: 'file:///app/index.html#/profiles' };
    const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
    const calls = [];
    registerDialogHandlers({ handle: (name, handler) => handlers.set(name, handler) }, {
        showOpenDialog: async (_window, options) => {
            calls.push(options);
            // Complete requests out of order; each caller must receive its own result.
            if (options.title === 'slow') await new Promise(resolve => setTimeout(resolve, 20));
            return { canceled: options.title === 'cancel', filePaths: [options.title] };
        }
    }, () => window, 'file:///app/index.html');
    const event = { sender: window.webContents, senderFrame: frame };
    const file = handlers.get('desktop:select-file');
    const folder = handlers.get('desktop:select-folder');
    assert.deepEqual(await Promise.all([file(event, { title: 'slow' }), folder(event, { title: 'fast' })]), [['slow'], ['fast']]);
    assert.deepEqual(await file(event, { title: 'cancel' }), []);
    assert.deepEqual(calls[0].properties, ['openFile', 'showHiddenFiles']);
    assert.deepEqual(calls[1].properties, ['openDirectory', 'showHiddenFiles']);
    const before = calls.length;
    await assert.rejects(file({ ...event, sender: {} }, {}), /Untrusted/);
    await assert.rejects(file({ ...event, senderFrame: { url: frame.url } }, {}), /Untrusted/);
    frame.url = 'https://untrusted.example/';
    await assert.rejects(file(event, {}), /Untrusted/);
    frame.url = 'file:///app/index.html#/profiles';
    await assert.rejects(file(event, { title: 7 }), /Invalid/);
    await assert.rejects(file(event, { filters: [{ name: 'bad', extensions: ['../dll'] }] }), /Invalid/);
    assert.equal(calls.length, before);
    assert.deepEqual(validateOptions({ properties: ['multiSelections'], filters: [{ name: 'Profile', extensions: ['r2z'] }] }, 'file').properties, ['openFile', 'showHiddenFiles']);
    for (const isolated of [false, true]) {
        const invocations = [];
        const sandbox = { window: {}, process: { contextIsolated: isolated }, require: () => ({
            contextBridge: { exposeInMainWorld: (name, api) => { sandbox.window[name] = api; } },
            ipcRenderer: { invoke: (channel, options) => { invocations.push(channel); return Promise.resolve([options.title]); } }
        }) };
        vm.runInNewContext(fs.readFileSync('src-electron/main-process/electron-preload.js', 'utf8'), sandbox);
        const api = sandbox.window.r2modmanDialogs;
        assert.deepEqual(Object.keys(api), ['selectFile', 'selectFolder']);
        assert(Object.isFrozen(api));
        assert.deepEqual(await api.selectFile({ title: 'file' }), ['file']);
        assert.deepEqual(await api.selectFolder({ title: 'folder' }), ['folder']);
        assert.deepEqual(invocations, ['desktop:select-file', 'desktop:select-folder']);
    }
    console.log('PASS: correlated dialogs, cancellation, sender/payload validation, narrow preload API in both contexts');
})().catch(error => { console.error(error); process.exitCode = 1; });
