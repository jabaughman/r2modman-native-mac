require('ts-node/register/transpile-only');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const overrides = require('../../src/utils/LocalModOverrides');
const ProfileModList = require('../../src/r2mm/mods/ProfileModList').default;
const FsProvider = require('../../src/providers/generic/file/FsProvider').default;
const NodeFs = require('../../src/providers/generic/file/NodeFs').default;
const ZipProvider = require('../../src/providers/generic/zip/ZipProvider').default;
const ProfileUtils = require('../../src/utils/ProfileUtils');
const Installer = require('../../src/r2mm/installing/profile_installers/GenericProfileInstaller').default;
(async () => {
    const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'r2mm-overrides-'));
    const name = 'Author-MacPlugin';
    try {
        assert.equal(await overrides.guardLocalOverride(root, 'Custom local mod-v2'), null);
        // Unprotected packages do not need a BepInEx directory or a particular layout.
        await fs.ensureDir(path.join(root, 'BepInEx/plugins'));
        await fs.symlink(root, path.join(root, 'BepInEx/plugins/Other-Plugin'));
        assert.equal(await overrides.guardLocalOverride(root, 'Other-Plugin'), null);
        await fs.remove(path.join(root, 'BepInEx/plugins/Other-Plugin'));
        const p = await overrides.overridePaths(root, name);
        await fs.ensureDir(p.directory);
        await fs.writeFile(path.join(p.directory, 'plugin.dll'), 'mac replacement');
        assert.equal(await overrides.guardLocalOverride(root, name), null);
        await overrides.protectLocalOverride(root, name);
        assert.equal((await overrides.guardLocalOverride(root, name)).name, 'Local replacement protected');
        const installer = new Installer();
        installer.getInstallArgs = () => { throw new Error('Installation reached mutation path'); };
        installer.uninstallModLoaderWithInstaller = () => { throw new Error('Uninstall reached mutation path'); };
        const mod = { getName: () => name };
        const profile = { getPathOfProfile: () => root };
        assert.equal((await installer.installMod(mod, profile)).name, 'Local replacement protected');
        assert.equal((await installer.uninstallMod(mod, profile)).name, 'Local replacement protected');
        // Repeated protection must not replace the saved snapshot.
        await fs.writeFile(path.join(p.directory, 'plugin.dll'), 'changed');
        await overrides.protectLocalOverride(root, name);
        assert.equal(await fs.readFile(path.join(p.backup, 'plugin.dll'), 'utf8'), 'mac replacement');
        await overrides.releaseLocalOverride(root, name);
        assert.equal(await overrides.guardLocalOverride(root, name), null);
        assert(await overrides.hasLocalBackup(root, name));
        await fs.writeFile(path.join(p.directory, 'extra.dll'), 'catalog addition');
        await overrides.restoreLocalOverride(root, name);
        assert.equal(await fs.readFile(path.join(p.directory, 'plugin.dll'), 'utf8'), 'mac replacement');
        assert(!await fs.pathExists(path.join(p.directory, 'extra.dll')));
        assert(await overrides.isLocalOverride(root, name));
        await assert.rejects(overrides.overridePaths(root, '../escape'));
        await fs.symlink(root, path.join(p.backup, 'link'));
        await assert.rejects(overrides.restoreLocalOverride(root, name));
        assert.equal(await fs.readFile(path.join(p.directory, 'plugin.dll'), 'utf8'), 'mac replacement');
        await fs.remove(path.join(p.backup, 'link'));
        const exported = [];
        FsProvider.provide(() => new NodeFs());
        ProfileModList.getModList = async () => [];
        ZipProvider.provide(() => ({ zipBuilder: () => ({ addBuffer: async name => exported.push(name) }),
            getEntries: async () => [{ entryName: '.local-overrides/Author-MacPlugin/protected.json' }],
            extractEntryTo: async () => { throw new Error('Import reached local protection metadata'); } }));
        await fs.writeFile(path.join(p.backup, 'settings.cfg'), 'local-only snapshot');
        await ProfileModList.createExport({ getPathOfProfile: () => root, getProfileName: () => 'Test' });
        assert(exported.includes('export.r2x'));
        assert(!exported.some(name => name.startsWith('.local-overrides/')));
        await ProfileUtils.extractZippedProfileFile('fixture.r2z', 'Test');
        await fs.remove(p.marker);
        await fs.symlink(root, p.marker);
        await assert.rejects(overrides.guardLocalOverride(root, name));
        console.log('PASS: protection, release, exact backup restore, idempotence, traversal and symlink rejection');
    } finally { await fs.remove(root); }
})().catch(error => { console.error(error); process.exitCode = 1; });
