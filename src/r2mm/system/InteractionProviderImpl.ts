import InteractionProvider, {
    InteractionProviderFileProperties,
    InteractionProviderFolderProperties
} from '../../providers/ror2/system/InteractionProvider';
import { desktopLifecycle } from '../../utils/DesktopLifecycle';
import { desktopDialogs } from '../../utils/DesktopDialogs';

export default class InteractionProviderImpl extends InteractionProvider {

    restartApp(): Promise<void> {
        return desktopLifecycle().restart();
    }

    async selectFolder(options: InteractionProviderFolderProperties): Promise<string[]> {
        return desktopDialogs().selectFolder(options);
    }

    async selectFile(options: InteractionProviderFileProperties): Promise<string[]> {
        return desktopDialogs().selectFile(options);
    }


    private unsubscribeInstall: (() => void) | undefined;

    hookModInstallProtocol(callback: (data: string) => void): () => void {
        if (this.unsubscribeInstall) this.unsubscribeInstall();
        this.unsubscribeInstall = desktopLifecycle().onInstallRequest(callback);
        return this.unsubscribeInstall;
    }

    copyToClipboard(value: string): Promise<void> {
        return desktopLifecycle().copyText(value);
    }
}
