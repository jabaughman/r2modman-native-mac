import * as path from 'path';
import * as fs from 'fs';

/** Resolve an archive entry without allowing writes outside its extraction root. */
export async function resolveArchivePath(root: string, entryName: string): Promise<string> {
    const name = entryName.replace(/\\/g, '/');
    if (!name || name.includes('\0') || path.posix.isAbsolute(name) || /^[a-zA-Z]:/.test(name)
        || name.split('/').includes('..')) {
        throw new Error(`Unsafe archive entry: ${entryName}`);
    }
    const base = path.resolve(root);
    const target = path.resolve(base, name);
    const relative = path.relative(base, target);
    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`Archive entry escapes extraction directory: ${entryName}`);
    }
    // Reject existing symlinks, including the root and its ancestors. Do not follow
    // attacker-created links when extracting into an existing profile/cache.
    let current = target;
    while (true) {
        try {
            if ((await fs.promises.lstat(current)).isSymbolicLink()) {
                throw new Error(`Archive destination contains a symbolic link: ${current}`);
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return target;
}
