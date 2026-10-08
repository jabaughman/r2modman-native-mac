export interface DesktopShell {
    openExternal(url: string): Promise<void>;
    openLocal(path: string): Promise<void>;
    revealLocal(path: string): Promise<void>;
    verifySteam(identifier: string): Promise<void>;
    launchEpic(identifier: string): Promise<void>;
}

declare global {
    interface Window { readonly r2modmanShell: DesktopShell; }
}

export function desktopShell(): DesktopShell {
    if (!window.r2modmanShell) throw new Error('Desktop shell bridge is unavailable');
    return window.r2modmanShell;
}
