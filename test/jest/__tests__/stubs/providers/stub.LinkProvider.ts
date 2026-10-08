import LinkProvider from 'src/providers/components/LinkProvider';

export default class StubLinkProvider extends LinkProvider {

    async openLink(url: string): Promise<void> {
        throw new Error("Stub access must be mocked or spied");
    }

    async selectFile(url: string): Promise<void> {
        throw new Error("Stub access must be mocked or spied");
    }

}
