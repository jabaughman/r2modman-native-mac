import { InteractionProviderFileProperties, InteractionProviderFolderProperties } from '../providers/ror2/system/InteractionProvider';

export interface DesktopDialogs {
    selectFile(options: InteractionProviderFileProperties): Promise<string[]>;
    selectFolder(options: InteractionProviderFolderProperties): Promise<string[]>;
}

declare global {
    interface Window { readonly r2modmanDialogs: DesktopDialogs; }
}

export function desktopDialogs(): DesktopDialogs {
    if (!window.r2modmanDialogs) throw new Error('Desktop dialog bridge is unavailable');
    return window.r2modmanDialogs;
}
