import { PackageLoader } from '../model/installing/PackageLoader';

export interface ProfileLogScope { game: string; profile: string; loader: string; }
export interface DesktopProfileLogs {
    setDataRoot(root: string): Promise<void>;
    exists(scope: ProfileLogScope): Promise<boolean>;
    copy(scope: ProfileLogScope): Promise<void>;
}

declare global {
    interface Window { readonly r2modmanProfileLogs: DesktopProfileLogs; }
}
export function desktopProfileLogs(): DesktopProfileLogs {
    if (!window.r2modmanProfileLogs) throw new Error('Profile log bridge is unavailable');
    return window.r2modmanProfileLogs;
}
export function profileLogScope(game: string, profile: string, loader: PackageLoader): ProfileLogScope | undefined {
    const names: { [key: number]: string } = {
        [PackageLoader.BEPINEX]: 'bepinex', [PackageLoader.MELON_LOADER]: 'melonloader',
        [PackageLoader.NORTHSTAR]: 'northstar', [PackageLoader.RETURN_OF_MODDING]: 'returnofmodding'
    };
    return names[loader] ? { game, profile, loader: names[loader] } : undefined;
}
