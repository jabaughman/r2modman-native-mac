import InteractionProvider, {
    InteractionProviderFileProperties,
    InteractionProviderFolderProperties
} from '../../../../../src/providers/ror2/system/InteractionProvider';

export default class StubInteractionProvider extends InteractionProvider {

    async copyToClipboard(value: string): Promise<void> {
        throw new Error("Stub access must be mocked or spied");
    }

    hookModInstallProtocol(callback: (data: string) => void): () => void {
        throw new Error("Stub access must be mocked or spied");
    }

    async restartApp(): Promise<void> {
        throw new Error("Stub access must be mocked or spied");
    }

    async selectFile(options: InteractionProviderFileProperties): Promise<string[]> {
        throw new Error("Stub access must be mocked or spied");
    }

    async selectFolder(options: InteractionProviderFolderProperties): Promise<string[]> {
        throw new Error("Stub access must be mocked or spied");
    }

}
