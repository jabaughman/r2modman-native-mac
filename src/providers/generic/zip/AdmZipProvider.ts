import ZipProvider from './ZipProvider';
import AdmZip, { IZipEntry } from 'adm-zip';
import * as path from 'path';
import ZipBuilder from './ZipBuilder';
import ZipEntryInterface from './ZipEntryInterface';
import FileUtils from '../../../utils/FileUtils';
import FsProvider from '../file/FsProvider';
import { resolveArchivePath } from '../../../utils/SafePaths';

export default class AdmZipProvider extends ZipProvider {

    async extractAllTo(zip: string | Buffer, outputFolder: string): Promise<void> {
        const adm = new AdmZip(zip);
        for (let entry of adm.getEntries()) {
            await this.sanitizedExtraction(entry, outputFolder);
        }
    }

    async readFile(zip: string | Buffer, file: string): Promise<Buffer | null> {
        const adm = new AdmZip(zip);
        return adm.readFile(file);
    }

    async getEntries(zip: string | Buffer): Promise<ZipEntryInterface[]> {
        const adm = new AdmZip(zip);
        return (adm.getEntries() as unknown as ZipEntryInterface[]);
    }

    async extractEntryTo(zip: string | Buffer, target: string, outputPath: string): Promise<void> {
        const adm = new AdmZip(zip);
        return this.sanitizedExtraction(adm.getEntry(target)!, outputPath);
    }

    private async sanitizedExtraction(entry: IZipEntry, outputPath: string): Promise<void> {
        // ZIP Unix mode bits can describe a link even if the filename looks safe.
        if (((entry.header.attr >>> 16) & 0xf000) === 0xa000) {
            throw new Error(`Symbolic links are not supported in archives: ${entry.entryName}`);
        }
        const target = await resolveArchivePath(outputPath, entry.entryName);
        await FileUtils.ensureDirectory(path.dirname(target));
        if (entry.isDirectory)
            await FileUtils.ensureDirectory(target);
        else
            await FsProvider.instance.writeFile(target, entry.getData());
    }

    zipBuilder(): ZipBuilder {
        return new AdmZipBuilder();
    }
}

export class AdmZipBuilder extends ZipBuilder {

    private readonly zip: AdmZip;

    constructor() {
        super();
        this.zip = new AdmZip();
    }

    async addBuffer(fileName: string, contents: Buffer): Promise<void> {
        this.zip.addFile(fileName, contents);
    }

    async addFolder(zippedFolderName: string, folderName: string): Promise<void> {
        this.zip.addLocalFolder(folderName, zippedFolderName);
    }

    async createZip(outputPath: string): Promise<void> {
        this.zip.writeZip(outputPath);
    }

}
