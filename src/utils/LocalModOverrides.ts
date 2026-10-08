import * as fs from 'fs-extra';
import * as path from 'path';
import R2Error from '../model/errors/R2Error';
import { resolveArchivePath } from './SafePaths';

// Backups live outside the package directory so uninstall/reinstall cannot erase them.
export async function overridePaths(profile: string, name: string) {
    validateName(name);
    const directory = await resolveArchivePath(profile, `BepInEx/plugins/${name}`);
    const root = await resolveArchivePath(profile, `.local-overrides/${name}`);
    return { directory, root,
        marker: await resolveArchivePath(root, 'protected.json'),
        backup: await resolveArchivePath(root, 'backup'),
        pending: await resolveArchivePath(root, 'pending-backup') };
}

export async function isLocalOverride(profile: string, name: string): Promise<boolean> {
    validateName(name);
    // Checking protection must not constrain another game's plugin layout.
    const marker = await resolveArchivePath(profile, `.local-overrides/${name}/protected.json`);
    return fs.pathExists(marker);
}

export async function guardLocalOverride(profile: string, name: string): Promise<R2Error | null> {
    if (await isLocalOverride(profile, name)) return new R2Error(
        'Local replacement protected',
        `${name} has a protected local replacement. No package files were changed.`,
        'Use Release protection on the installed mod before updating, reinstalling, or uninstalling. The local backup remains available.'
    );
    return null;
}

export async function protectLocalOverride(profile: string, name: string) {
    const p = await overridePaths(profile, name);
    if (await fs.pathExists(p.marker)) return;
    if (!(await fs.stat(p.directory)).isDirectory()) throw new Error('This package has no separate BepInEx plugin directory');
    await validateTree(p.directory);
    await fs.ensureDir(p.root);
    const pending = p.pending;
    await fs.remove(pending);
    await fs.copy(p.directory, pending);
    await fs.remove(p.backup);
    await fs.move(pending, p.backup);
    await fs.writeJson(p.marker, { package: name, protectedAt: new Date().toISOString() });
}

export async function releaseLocalOverride(profile: string, name: string) {
    const p = await overridePaths(profile, name);
    await fs.remove(p.marker);
}

export async function hasLocalBackup(profile: string, name: string) {
    const p = await overridePaths(profile, name);
    return fs.pathExists(p.backup);
}

export async function restoreLocalOverride(profile: string, name: string) {
    const p = await overridePaths(profile, name);
    if (!await fs.pathExists(p.backup)) throw new Error('No local replacement backup exists');
    await validateTree(p.backup);
    if (await fs.pathExists(p.directory)) await validateTree(p.directory);
    // Remove catalog files first so restore reproduces the saved replacement exactly.
    await fs.remove(p.directory);
    await fs.copy(p.backup, p.directory);
    await fs.writeJson(p.marker, { package: name, protectedAt: new Date().toISOString() });
}

async function validateTree(directory: string): Promise<void> {
    const stat = await fs.lstat(directory);
    if (stat.isSymbolicLink()) throw new Error('Local replacement contains a symbolic link');
    if (!stat.isDirectory()) throw new Error('Expected a plugin directory');
    for (const entry of await fs.readdir(directory)) {
        const file = path.join(directory, entry);
        const child = await fs.lstat(file);
        if (child.isSymbolicLink()) throw new Error('Local replacement contains a symbolic link');
        if (child.isDirectory()) await validateTree(file);
    }
}

function validateName(name: string): void {
    if (!name || name === '.' || name === '..' || /[/\\:\0]/.test(name)) {
        throw new Error('Invalid package name');
    }
}
