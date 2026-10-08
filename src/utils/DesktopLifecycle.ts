export interface DesktopLifecycle {
    getStartupInfo(): Promise<{ appData: string; isPortable: boolean }>;
    prepareUpdates(): Promise<void>;
    copyText(value: string): Promise<void>;
    restart(): Promise<void>;
    onInstallRequest(callback: (value: string) => void): () => void;
}

declare global {
    interface Window { readonly r2modmanDesktop: DesktopLifecycle; }
}

export function desktopLifecycle(): DesktopLifecycle {
    if (!window.r2modmanDesktop) throw new Error('Desktop lifecycle bridge is unavailable');
    return window.r2modmanDesktop;
}
