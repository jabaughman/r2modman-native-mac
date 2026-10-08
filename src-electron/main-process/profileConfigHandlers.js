const fs = require('fs').promises;
const path = require('path');
const { authorizeSender } = require('./trustedSender');
const EXTENSIONS = new Set(['.cfg', '.txt', '.json', '.yml', '.yaml', '.ini']);
const EXCLUDED = new Set(['dotnet', '_state', '.local-overrides']);
const MAX_ENTRIES = 100000;
const MAX_DEPTH = 64;

function registerProfileConfigHandlers(ipcMain, profileFiles, getWindow, appUrl) {
    ipcMain.handle('desktop:list-profile-configs', async (event, scope) => {
        authorizeSender(event, getWindow, appUrl);
        const profile = await profileFiles.profilePath(scope);
        const files = [];
        let visited = 0;
        async function walk(directory, parts) {
            if (parts.length > MAX_DEPTH) throw new Error('Config discovery exceeded its directory depth limit');
            // Stream directory entries rather than allocating an unbounded listing.
            const entries = await fs.opendir(directory);
            for await (const entry of entries) {
                if (++visited > MAX_ENTRIES) throw new Error('Config discovery exceeded its entry limit');
                const relative = [...parts, entry.name];
                const target = path.join(directory, entry.name);
                const stat = await fs.lstat(target);
                // Neither files nor directories may redirect discovery outside the profile.
                if (stat.isSymbolicLink()) continue;
                if (stat.isDirectory()) {
                    if (!EXCLUDED.has(entry.name)) await walk(target, relative);
                } else if (stat.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                    if (!parts.length && entry.name.toLowerCase() !== 'ue4ss-settings.ini') continue;
                    if (parts.length === 3 && parts[0] === 'BepInEx' && parts[1] === 'plugins'
                        && entry.name === 'manifest.json') continue;
                    files.push({ relativePath: relative.join(path.sep), modifiedAt: stat.mtimeMs });
                }
            }
        }
        await walk(profile, []);
        return files;
    });
}
module.exports = { registerProfileConfigHandlers };
