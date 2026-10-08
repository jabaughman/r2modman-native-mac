import LinkProvider from '../../providers/components/LinkProvider';
import { desktopShell } from '../../utils/DesktopShell';
import * as path from 'path';
import { fileURLToPath } from 'url';

export default class LinkImpl extends LinkProvider {
    async openLink(url: string): Promise<void> {
        if (path.isAbsolute(url)) return desktopShell().openLocal(url);
        if (url.startsWith('file://')) return desktopShell().openLocal(fileURLToPath(url));
        if (url.startsWith('steam://validate/')) return desktopShell().verifySteam(url.slice('steam://validate/'.length));
        return desktopShell().openExternal(url);
    }

    selectFile(url: string): Promise<void> {
        return desktopShell().revealLocal(url);
    }
}
