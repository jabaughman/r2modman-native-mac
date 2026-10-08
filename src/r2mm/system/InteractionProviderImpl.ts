import InteractionProvider, {
    InteractionProviderFileProperties,
    InteractionProviderFolderProperties
} from '../../providers/ror2/system/InteractionProvider';
import { clipboard, ipcRenderer } from 'electron';
import { desktopDialogs } from '../../utils/DesktopDialogs';

export default class InteractionProviderImpl extends InteractionProvider {

    restartApp(): void {
        ipcRenderer.send('restart');
    }

    async selectFolder(options: InteractionProviderFolderProperties): Promise<string[]> {
        return desktopDialogs().selectFolder(options);
    }

    async selectFile(options: InteractionProviderFileProperties): Promise<string[]> {
        return desktopDialogs().selectFile(options);
    }


    hookModInstallProtocol(callback: (data: any) => void) {
        ipcRenderer.removeAllListeners('install-from-thunderstore-string');
        ipcRenderer.on('install-from-thunderstore-string', (_sender: any, data: string) => {
            callback(data);
        });
    }


    copyToClipboard(value: string) {
        clipboard.writeText(value);
    }
}
