import Profile from '../../model/Profile';
import { desktopProfileLogs, profileLogScope } from '../../utils/DesktopProfileLogs';
import GameManager from '../../model/game/GameManager';
import Timeout = NodeJS.Timeout;


export default class LogOutput {

    private _exists: boolean = false;

    private static INTERVAL: Timeout | undefined;
    private static LOG_OUTPUT: LogOutput | undefined;

    public static getSingleton(): LogOutput {
        if (this.LOG_OUTPUT === undefined) {
            this.LOG_OUTPUT = new LogOutput();
        }
        return this.LOG_OUTPUT;
    }

    private constructor() {
        this.confirmOutputExists();

        LogOutput.INTERVAL = setInterval(() => {
            this.confirmOutputExists();
        }, 1000);
    }

    private checking = false;

    private async confirmOutputExists() {
        if (this.checking) return;
        const game = GameManager.activeGame;
        const profile = Profile.getActiveProfile();
        if (!game || !profile) { this._exists = false; return; }
        const scope = profileLogScope(game.internalFolderName, profile.getProfileName(), game.packageLoader);
        if (!scope) { this._exists = false; return; }
        this.checking = true;
        try {
            const exists = await desktopProfileLogs().exists(scope);
            if (game === GameManager.activeGame && profile === Profile.getActiveProfile()) this._exists = exists;
        } catch (_) { this._exists = false; }
        finally { this.checking = false; }
    }

    get exists(): boolean {
        return this._exists;
    }


    set exists(value: boolean) {
        this._exists = value;
    }


    public disconnect() {
        if (LogOutput.INTERVAL !== undefined) {
            clearInterval(LogOutput.INTERVAL);
        }
    }
}
