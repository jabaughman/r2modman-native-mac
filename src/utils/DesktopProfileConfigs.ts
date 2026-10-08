export interface ProfileConfigScope { game: string; profile: string; }
export interface ProfileConfigEntry { relativePath: string; modifiedAt: number; }
export interface DesktopProfileConfigs {
    list(scope: ProfileConfigScope): Promise<ProfileConfigEntry[]>;
}
declare global {
    interface Window { readonly r2modmanProfileConfigs: DesktopProfileConfigs; }
}
export function desktopProfileConfigs(): DesktopProfileConfigs {
    if (!window.r2modmanProfileConfigs) throw new Error('Profile config bridge is unavailable');
    return window.r2modmanProfileConfigs;
}
