const fs = require('fs').promises;
const path = require('path');
const { authorizeSender } = require('./trustedSender');
const LOGS = { bepinex: ['BepInEx', 'LogOutput.log'], melonloader: ['MelonLoader', 'Latest.log'],
    northstar: ['MelonLoader', 'Latest.log'], returnofmodding: ['ReturnOfModding', 'LogOutput.log'] };
const MAX_BYTES = 16 * 1024 * 1024;

function component(value) {
    if (typeof value !== 'string' || !value || value.length > 255 || value === '.' || value === '..'
        || /[/\\:\0\r\n]/.test(value)) throw new Error('Invalid profile log scope');
    return value;
}
function inside(root, target) {
    const relative = path.relative(root, target);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function registerProfileLogHandlers(ipcMain, services, getWindow, appUrl) {
    let dataRoot;
    const handle = (channel, action) => ipcMain.handle(channel, (event, value) => {
        authorizeSender(event, getWindow, appUrl);
        return action(value);
    });
    handle('desktop:set-log-data-root', async value => {
        if (typeof value !== 'string' || value.includes('\0') || !path.isAbsolute(value)) throw new Error('Invalid data root');
        const canonical = await fs.realpath(value);
        if (!(await fs.stat(canonical)).isDirectory()) throw new Error('Data root is not a directory');
        if (dataRoot && dataRoot !== canonical) throw new Error('Log data root is already initialized; restart to change it');
        dataRoot = canonical;
    });
    async function profilePath(scope) {
        if (!dataRoot) throw new Error('Log data root has not been initialized');
        if (!scope || typeof scope !== 'object') throw new Error('Invalid profile scope');
        const profile = path.join(dataRoot, component(scope.game), 'profiles', component(scope.profile));
        let current = dataRoot;
        for (const segment of path.relative(dataRoot, profile).split(path.sep)) {
            current = path.join(current, segment);
            const stat = await fs.lstat(current);
            if (stat.isSymbolicLink()) throw new Error('Profile contains a symbolic link');
            if (!stat.isDirectory()) throw new Error('Profile is not a directory');
        }
        return profile;
    }
    async function logPath(scope) {
        if (!dataRoot) throw new Error('Log data root has not been initialized');
        if (!scope || typeof scope !== 'object' || !Object.prototype.hasOwnProperty.call(LOGS, scope.loader)) throw new Error('Unsupported log loader');
        const profile = path.join(dataRoot, component(scope.game), 'profiles', component(scope.profile));
        const target = path.join(profile, ...LOGS[scope.loader]);
        // No directory/file symlink may redirect the scoped operation elsewhere.
        let current = dataRoot;
        for (const segment of path.relative(dataRoot, target).split(path.sep)) {
            current = path.join(current, segment);
            if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Profile log contains a symbolic link');
        }
        const canonical = await fs.realpath(target);
        if (!inside(profile, canonical)) throw new Error('Profile log escapes its profile');
        if (!(await fs.stat(canonical)).isFile()) throw new Error('Profile log is not a regular file');
        return canonical;
    }
    handle('desktop:profile-log-exists', async scope => {
        try { await logPath(scope); return true; }
        catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; }
    });
    handle('desktop:copy-profile-log', async scope => {
        const target = await logPath(scope);
        const file = await fs.open(target, require('fs').constants.O_RDONLY | (require('fs').constants.O_NOFOLLOW || 0));
        try {
            const stat = await file.stat();
            if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Profile log is too large to copy (16 MiB limit)');
            const buffer = Buffer.alloc(MAX_BYTES + 1);
            let size = 0;
            while (size < buffer.length) {
                const result = await file.read(buffer, size, buffer.length - size, size);
                if (!result.bytesRead) break;
                size += result.bytesRead;
            }
            if (size > MAX_BYTES) throw new Error('Profile log is too large to copy (16 MiB limit)');
            const text = buffer.subarray(0, size).toString('utf8');
            services.clipboard.writeText(text.length >= 1992 ? text : `\`\`\`\n${text}\n\`\`\``);
        } finally { await file.close(); }
    });
    return { profilePath };
}
module.exports = { registerProfileLogHandlers };
