const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { registerProfileLogHandlers } = require('../../src-electron/main-process/profileLogHandlers');
const { registerProfileConfigHandlers } = require('../../src-electron/main-process/profileConfigHandlers');
(async () => {
    const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'r2mm-configs-'));
    try {
        const handlers = new Map(), ipc = { handle: (name, handler) => handlers.set(name, handler) };
        const frame = { url: 'file:///app/index.html#/manager' };
        const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
        const event = { sender: window.webContents, senderFrame: frame };
        const profileFiles = registerProfileLogHandlers(ipc, {}, () => window, 'file:///app/index.html');
        registerProfileConfigHandlers(ipc, profileFiles, () => window, 'file:///app/index.html');
        const list = scope => handlers.get('desktop:list-profile-configs')(event, scope);
        const scope = { game: 'FixtureGame', profile: 'Two Words' };
        await assert.rejects(list(scope), /initialized/);
        await handlers.get('desktop:set-log-data-root')(event, root);
        const profile = path.join(root, scope.game, 'profiles', scope.profile);
        const included = ['BepInEx/config/a.cfg', 'BepInEx/config/b.TXT', 'BepInEx/config/c.json',
            'BepInEx/config/d.yml', 'BepInEx/config/e.yaml', 'BepInEx/config/f.ini',
            'BepInEx/plugins/package/settings.json', 'BepInEx/plugins/package/nested/manifest.json', 'UE4SS-settings.ini'];
        const excluded = ['root.json', 'BepInEx/plugins/package/manifest.json', 'BepInEx/config/a.dll',
            'dotnet/settings.json', '_state/settings.cfg', '.local-overrides/package/settings.cfg',
            'BepInEx/config/.local-overrides/backup.cfg'];
        for (const name of [...included, ...excluded]) await fs.outputFile(path.join(profile, name), 'fixture');
        await fs.outputFile(path.join(root, 'outside/secret.cfg'), 'secret');
        await fs.symlink(path.join(root, 'outside'), path.join(profile, 'linked-directory'));
        await fs.symlink(path.join(root, 'outside/secret.cfg'), path.join(profile, 'BepInEx/config/linked.cfg'));
        const result = await list(scope);
        assert.deepEqual(result.map(x => x.relativePath).sort(), included.sort());
        assert(result.every(x => Number.isFinite(x.modifiedAt)));
        for (const bad of [null, { ...scope, game: '..' }, { ...scope, profile: '../other' }, { ...scope, profile: '/absolute' }]) await assert.rejects(list(bad));
        for (const bad of [{ ...event, sender: {} }, { ...event, senderFrame: {} }]) {
            await assert.rejects(async () => handlers.get('desktop:list-profile-configs')(bad, scope), /Untrusted/);
        }
        await fs.symlink(path.join(root, 'outside'), path.join(root, scope.game, 'profiles', 'Linked'));
        await assert.rejects(list({ ...scope, profile: 'Linked' }), /symbolic link/);
        const deep = path.join(profile, ...Array(65).fill('nested'));
        await fs.ensureDir(deep);
        await assert.rejects(list(scope), /depth limit/);
        for (const isolated of [false, true]) {
            const calls = [];
            const sandbox = { window: {}, process: { contextIsolated: isolated }, require: () => ({
                contextBridge: { exposeInMainWorld: (name, api) => { sandbox.window[name] = api; } },
                ipcRenderer: { invoke: async (...args) => calls.push(args) }
            }) };
            vm.runInNewContext(fs.readFileSync('src-electron/main-process/electron-preload.js', 'utf8'), sandbox);
            const api = sandbox.window.r2modmanProfileConfigs;
            assert(Object.isFrozen(api)); assert.deepEqual(Object.keys(api), ['list']);
            await api.list(scope); assert.deepEqual(calls, [['desktop:list-profile-configs', scope]]);
        }
        console.log('PASS: config discovery filters, timestamps, scoped paths, symlinks, sender validation, depth bound and preload routing');
    } finally { await fs.remove(root); }
})().catch(error => { console.error(error); process.exitCode = 1; });
