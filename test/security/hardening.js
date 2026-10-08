require('ts-node/register/transpile-only');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');
const { resolveArchivePath } = require('../../src/utils/SafePaths');
const { splitArguments, startProcess } = require('../../src/utils/ProcessUtils');
const FsProvider = require('../../src/providers/generic/file/FsProvider').default;
const NodeFs = require('../../src/providers/generic/file/NodeFs').default;
const ZipProvider = require('../../src/providers/generic/zip/AdmZipProvider').default;
(async () => {
    const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'r2mm-security-'));
    const root = path.join(temp, 'extract');
    const outside = path.join(temp, 'outside');
    fs.mkdirSync(root); fs.mkdirSync(outside);
    FsProvider.provide(() => new NodeFs());
    try {
        const extractor = new ZipProvider();
        const good = new AdmZip(); good.addFile('BepInEx/plugins/good.dll', Buffer.from('fixture'));
        await extractor.extractAllTo(good.toBuffer(), root);
        assert.equal(fs.readFileSync(path.join(root, 'BepInEx/plugins/good.dll'), 'utf8'), 'fixture');
        for (const name of ['../outside/evil.dll', 'config/../../outside/evil.dll', '..\\outside\\evil.dll', '/tmp/evil.dll', 'C:\\evil.dll']) {
            const zip = new AdmZip(); zip.addFile('fixture.dll', Buffer.from('bad'));
            zip.getEntries()[0].entryName = name;
            await assert.rejects(extractor.extractAllTo(zip.toBuffer(), root));
            assert(!fs.existsSync(path.join(outside, 'evil.dll')));
        }
        fs.symlinkSync(outside, path.join(root, 'link'));
        await assert.rejects(resolveArchivePath(root, 'link/evil.dll'));
        const zip = new AdmZip(); zip.addFile('symlink', Buffer.from('../outside'));
        zip.getEntries()[0].attr = (0xa1ff << 16) >>> 0;
        await assert.rejects(extractor.extractAllTo(zip.toBuffer(), root));
        assert.deepEqual(splitArguments('--profile "Two Words" --empty ""'), ['--profile', 'Two Words', '--empty', '']);
        await assert.rejects(startProcess(path.join(temp, 'missing'), []));
        // A shell metacharacter argument must be received literally by the child.
        const script = path.join(temp, 'args.js'), output = path.join(temp, 'args.json'), marker = path.join(temp, 'marker');
        fs.writeFileSync(script, 'require("fs").writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)))');
        const literal = `$(touch ${marker}); echo unsafe`;
        await startProcess(process.execPath, [script, output, literal, 'Two Words']);
        for (let i = 0; i < 100 && !fs.existsSync(output); i++) await new Promise(r => setTimeout(r, 20));
        assert.deepEqual(JSON.parse(fs.readFileSync(output)), [literal, 'Two Words']);
        assert(!fs.existsSync(marker));
        console.log('PASS: normal extraction, traversal, symlinks, argument quoting, literal process arguments, missing launcher');
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
