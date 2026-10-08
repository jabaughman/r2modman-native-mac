require('ts-node/register/transpile-only');
const assert = require('assert');
const Interaction = require('../../src/r2mm/system/InteractionProviderImpl').default;
const fs = require('fs');
const vm = require('vm');
const { registerLifecycleHandlers } = require('../../src-electron/main-process/lifecycleHandlers');
(async () => {
    const handlers = new Map(), calls = [], sent = [];
    const frame = { url: 'file:///app/index.html#/profiles' };
    const window = { isDestroyed: () => false, webContents: { mainFrame: frame, send: (...args) => sent.push(args) } };
    const app = { getPath: name => { assert.equal(name, 'appData'); return '/fixture/app-data'; },
        relaunch: () => calls.push('relaunch'), exit: () => calls.push('exit') };
    const forward = registerLifecycleHandlers({ handle: (name, handler) => handlers.set(name, handler) }, {
        app, isPortable: () => false, prepareUpdates: () => calls.push('prepare-updates'),
        clipboard: { writeText: value => calls.push(['copy', value]) }
    }, () => window, 'file:///app/index.html');
    const event = { sender: window.webContents, senderFrame: frame };
    const invoke = async (name, ...args) => handlers.get(name)(event, ...args);
    assert.deepEqual(await invoke('desktop:get-startup-info'), { appData: '/fixture/app-data', isPortable: false });
    await invoke('desktop:prepare-updates');
    await invoke('desktop:copy-text', 'fixture text');
    await invoke('desktop:restart');
    assert.deepEqual(calls, ['prepare-updates', ['copy', 'fixture text'], 'relaunch', 'exit']);
    const before = calls.length;
    await assert.rejects(invoke('desktop:copy-text', {}), /Invalid/);
    await assert.rejects(invoke('desktop:copy-text', 'x'.repeat(16 * 1024 * 1024 + 1)), /Invalid/);
    for (const handler of handlers.values()) {
        await assert.rejects(async () => handler({ ...event, sender: {} }), /Untrusted/);
        await assert.rejects(async () => handler({ ...event, senderFrame: { url: frame.url } }), /Untrusted/);
        frame.url = 'https://untrusted.example/';
        await assert.rejects(async () => handler(event), /Untrusted/);
        frame.url = 'file:///app/index.html#/profiles';
    }
    assert.equal(calls.length, before);
    const protocol = 'ror2mm://v1/install/thunderstore.io/Fixture/Plugin/1.2.3/';
    assert(forward(protocol));
    assert.deepEqual(sent, [['desktop:install-request', protocol]]);
    for (const bad of [null, {}, 'https://example.com', 'ror2mm://v1/install/evil.example/Fixture/Plugin/1.2.3', protocol + '\n']) assert.equal(forward(bad), false);
    frame.url = 'https://untrusted.example/';
    assert.equal(forward(protocol), false);
    assert.equal(sent.length, 1);
    for (const isolated of [false, true]) {
        const listeners = new Set(), invocations = [], received = [];
        const sandbox = { window: {}, process: { contextIsolated: isolated }, require: () => ({
            contextBridge: { exposeInMainWorld: (name, api) => { sandbox.window[name] = api; } },
            ipcRenderer: {
                invoke: async (channel, ...args) => { invocations.push([channel, ...args]); },
                on: (channel, listener) => { assert.equal(channel, 'desktop:install-request'); listeners.add(listener); },
                removeListener: (channel, listener) => listeners.delete(listener)
            }
        }) };
        vm.runInNewContext(fs.readFileSync('src-electron/main-process/electron-preload.js', 'utf8'), sandbox);
        const api = sandbox.window.r2modmanDesktop;
        assert(Object.isFrozen(api));
        assert.deepEqual(Object.keys(api), ['getStartupInfo', 'prepareUpdates', 'copyText', 'restart', 'onInstallRequest']);
        await api.getStartupInfo(); await api.prepareUpdates(); await api.copyText('text'); await api.restart();
        assert.deepEqual(invocations, [['desktop:get-startup-info'], ['desktop:prepare-updates'], ['desktop:copy-text', 'text'], ['desktop:restart']]);
        const unsubscribe = api.onInstallRequest((...args) => received.push(args));
        const listener = [...listeners][0];
        listener({ sender: { privileged: true } }, protocol);
        listener({}, { invalid: true });
        assert.deepEqual(received, [[protocol]]); // No Electron event reaches the callback.
        unsubscribe(); unsubscribe();
        assert.equal(listeners.size, 0);
        global.window = sandbox.window;
        const provider = new Interaction();
        let stale = 0, current = 0;
        provider.hookModInstallProtocol(() => stale++);
        const dispose = provider.hookModInstallProtocol(() => current++);
        assert.equal(listeners.size, 1);
        [...listeners][0]({}, protocol);
        assert.equal(stale, 0); assert.equal(current, 1);
        dispose(); assert.equal(listeners.size, 0);
        await provider.copyToClipboard('provider text');
        await provider.restartApp();
        assert.deepEqual(invocations.slice(-2), [['desktop:copy-text', 'provider text'], ['desktop:restart']]);
        delete global.window;
    }
    console.log('PASS: lifecycle methods, clipboard validation, trusted senders, filtered notifications and listener cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
