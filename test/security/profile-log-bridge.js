require('ts-node/register/transpile-only');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { registerProfileLogHandlers } = require('../../src-electron/main-process/profileLogHandlers');
(async () => {
    const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'r2mm-logs-'));
    const external = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'r2mm-outside-'));
    try {
        const handlers = new Map(), copies = [], frame = { url: 'file:///app/index.html#/manager' };
        const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
        registerProfileLogHandlers({ handle: (name, handler) => handlers.set(name, handler) }, {
            clipboard: { writeText: value => copies.push(value) }
        }, () => window, 'file:///app/index.html');
        const event = { sender: window.webContents, senderFrame: frame };
        const invoke = async (channel, value) => handlers.get(channel)(event, value);
        const scope = { game: 'FixtureGame', profile: 'Two Words', loader: 'bepinex' };
        await assert.rejects(invoke('desktop:profile-log-exists', scope), /initialized/);
        // A legacy custom root without a marker is accepted once; it cannot be changed by subsequent requests.
        await invoke('desktop:set-log-data-root', root);
        await invoke('desktop:set-log-data-root', root);
        await assert.rejects(invoke('desktop:set-log-data-root', external), /already initialized/);
        assert.equal(await invoke('desktop:profile-log-exists', scope), false);
        await assert.rejects(invoke('desktop:copy-profile-log', scope), /ENOENT/);
        const profile = path.join(root, scope.game, 'profiles', scope.profile);
        const log = path.join(profile, 'BepInEx/LogOutput.log');
        await fs.outputFile(log, 'fixture log');
        assert.equal(await invoke('desktop:profile-log-exists', scope), true);
        await invoke('desktop:copy-profile-log', scope);
        assert.equal(copies.pop(), '```\nfixture log\n```');
        await fs.writeFile(log, 'x'.repeat(2000));
        await invoke('desktop:copy-profile-log', scope);
        assert.equal(copies.pop(), 'x'.repeat(2000));
        for (const [loader, relative] of [['melonloader', 'MelonLoader/Latest.log'], ['northstar', 'MelonLoader/Latest.log'], ['returnofmodding', 'ReturnOfModding/LogOutput.log']]) {
            await fs.outputFile(path.join(profile, relative), 'alternate loader');
            assert(await invoke('desktop:profile-log-exists', { ...scope, loader }));
            await invoke('desktop:copy-profile-log', { ...scope, loader });
            assert.equal(copies.pop(), '```\n' + 'alternate loader' + '\n```');
        }
        for (const bad of [{ ...scope, game: '..' }, { ...scope, profile: '../outside' }, { ...scope, loader: '__proto__' }, { ...scope, loader: 'unsupported' }]) {
            await assert.rejects(invoke('desktop:profile-log-exists', bad));
            await assert.rejects(invoke('desktop:copy-profile-log', bad));
        }
        await fs.remove(log); await fs.outputFile(path.join(external, 'secret'), 'outside content');
        await fs.symlink(path.join(external, 'secret'), log);
        await assert.rejects(invoke('desktop:copy-profile-log', scope), /symbolic link/);
        await fs.remove(log); await fs.ensureDir(log);
        await assert.rejects(invoke('desktop:copy-profile-log', scope), /regular file/);
        await fs.remove(log); await fs.writeFile(log, '');
        await fs.truncate(log, 16 * 1024 * 1024 + 1);
        await assert.rejects(invoke('desktop:copy-profile-log', scope), /too large/);
        assert.equal(copies.length, 0);
        await fs.remove(profile);
        await fs.outputFile(path.join(external, 'BepInEx/LogOutput.log'), 'outside profile');
        await fs.symlink(external, profile);
        await assert.rejects(invoke('desktop:copy-profile-log', scope), /symbolic link/);
        for (const handler of handlers.values()) {
            await assert.rejects(async () => handler({ ...event, sender: {} }, scope), /Untrusted/);
            await assert.rejects(async () => handler({ ...event, senderFrame: { url: frame.url } }, scope), /Untrusted/);
        }
        for (const isolated of [false, true]) {
            const calls = [];
            const sandbox = { window: {}, process: { contextIsolated: isolated }, require: () => ({
                contextBridge: { exposeInMainWorld: (name, api) => { sandbox.window[name] = api; } },
                ipcRenderer: { invoke: async (...args) => calls.push(args) }
            }) };
            vm.runInNewContext(fs.readFileSync('src-electron/main-process/electron-preload.js', 'utf8'), sandbox);
            const api = sandbox.window.r2modmanProfileLogs;
            assert(Object.isFrozen(api));
            assert.deepEqual(Object.keys(api), ['setDataRoot', 'exists', 'copy']);
            await api.setDataRoot(root); await api.exists(scope); await api.copy(scope);
            assert.deepEqual(calls.map(call => call[0]), ['desktop:set-log-data-root', 'desktop:profile-log-exists', 'desktop:copy-profile-log']);
        }
        console.log('PASS: fixed loader logs, one-time custom root, clipboard formatting, missing files, traversal/symlink rejection, size bounds and sender checks');
    } finally { await fs.remove(root); await fs.remove(external); }
})().catch(error => { console.error(error); process.exitCode = 1; });
