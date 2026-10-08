require('ts-node/register/transpile-only');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { registerShellHandlers } = require('../../src-electron/main-process/shellHandlers');
const EpicRunner = require('../../src/r2mm/launching/runners/multiplatform/EgsGameRunner').default;
const LinkImpl = require('../../src/r2mm/component_override/LinkImpl').default;
(async () => {
    const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'r2mm-shell-'));
    try {
        const cfg = path.join(root, 'Config #1.cfg'), exe = path.join(root, 'plugin.exe');
        await fs.writeFile(cfg, 'fixture config'); await fs.writeFile(exe, 'fixture executable');
        await fs.symlink(exe, path.join(root, 'disguised.cfg'));
        const frame = { url: 'file:///app/index.html#/manager' }, calls = [], handlers = new Map();
        const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
        registerShellHandlers({ handle: (name, handler) => handlers.set(name, handler) }, {
            openExternal: async value => { calls.push(['external', value]); },
            openPath: async value => { calls.push(['open', value]); return value === root ? 'fixture failure' : ''; },
            showItemInFolder: value => calls.push(['reveal', value])
        }, () => window, 'file:///app/index.html');
        const event = { sender: window.webContents, senderFrame: frame };
        const invoke = async (name, value) => handlers.get(name)(event, value);
        await invoke('desktop:open-external', 'https://example.com/path?q=one');
        await invoke('desktop:open-local', cfg);
        await invoke('desktop:reveal-local', exe); // Reveal does not execute the file.
        await invoke('desktop:verify-steam', '12345');
        await invoke('desktop:launch-epic', 'Namespace:Catalog:App');
        assert.deepEqual(calls, [['external', 'https://example.com/path?q=one'], ['open', cfg], ['reveal', exe],
            ['external', 'steam://validate/12345'], ['external', 'com.epicgames.launcher://apps/Namespace:Catalog:App?action=launch&silent=true']]);
        const before = calls.length;
        for (const bad of ['javascript:alert(1)', 'file:///tmp/fixture.exe', 'steam://run/12345', 'https://user:pass@example.com', 'https://example.com\n']) {
            await assert.rejects(invoke('desktop:open-external', bad));
        }
        for (const bad of [exe, path.join(root, 'disguised.cfg'), 'relative.cfg', '/missing/fixture.cfg']) await assert.rejects(invoke('desktop:open-local', bad));
        await assert.rejects(invoke('desktop:verify-steam', '12345?evil=true'));
        await assert.rejects(invoke('desktop:launch-epic', 'App?action=uninstall'));
        for (const handler of handlers.values()) {
            await assert.rejects(async () => handler({ ...event, sender: {} }, cfg), /Untrusted/);
            await assert.rejects(async () => handler({ ...event, senderFrame: { url: frame.url } }, cfg), /Untrusted/);
        }
        assert.equal(calls.length, before);
        await assert.rejects(invoke('desktop:open-local', root), /fixture failure/);
        for (const isolated of [false, true]) {
            const invocations = [];
            const sandbox = { window: {}, process: { contextIsolated: isolated }, require: () => ({
                contextBridge: { exposeInMainWorld: (name, api) => { sandbox.window[name] = api; } },
                ipcRenderer: { invoke: async (channel, value) => invocations.push([channel, value]) }
            }) };
            vm.runInNewContext(fs.readFileSync('src-electron/main-process/electron-preload.js', 'utf8'), sandbox);
            assert(Object.isFrozen(sandbox.window.r2modmanShell));
            assert.deepEqual(Object.keys(sandbox.window.r2modmanShell), ['openExternal', 'openLocal', 'revealLocal', 'verifySteam', 'launchEpic']);
            global.window = sandbox.window;
            const link = new LinkImpl();
            await link.openLink('https://example.com'); await link.openLink(cfg);
            await link.openLink(pathToFileURL(cfg).href); await link.openLink('steam://validate/12345'); await link.selectFile(cfg);
            await sandbox.window.r2modmanShell.launchEpic('App');
            assert.deepEqual(invocations, [['desktop:open-external', 'https://example.com'], ['desktop:open-local', cfg],
                ['desktop:open-local', cfg], ['desktop:verify-steam', '12345'], ['desktop:reveal-local', cfg], ['desktop:launch-epic', 'App']]);
            const runner = new EpicRunner();
            assert.equal(await runner.start({ activePlatform: { storeIdentifier: 12345 } }, ''), undefined);
            assert.deepEqual(invocations.at(-1), ['desktop:launch-epic', '12345']);
            global.window = { r2modmanShell: { launchEpic: async () => { throw new Error('fixture launch error'); } } };
            const error = await runner.start({ activePlatform: { storeIdentifier: 'App' } }, '');
            assert.equal(error.name, 'Failed to start the game');
            assert.equal(error.message, 'fixture launch error');
            delete global.window;
        }
        console.log('PASS: shell routing, local config/reveal, URL validation, launcher identifiers, symlink execution rejection and error propagation');
    } finally { await fs.remove(root); }
})().catch(error => { console.error(error); process.exitCode = 1; });
