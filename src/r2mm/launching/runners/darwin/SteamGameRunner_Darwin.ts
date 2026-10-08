import { homedir } from 'os';
import FsProvider from '../../../../providers/generic/file/FsProvider';
import path from 'path';
import GameRunnerProvider from '../../../../providers/generic/game/GameRunnerProvider';
import Game from '../../../../model/game/Game';
import R2Error from '../../../../model/errors/R2Error';
import Profile from '../../../../model/Profile';
import ManagerSettings from '../../../manager/ManagerSettings';
import LoggerProvider, { LogSeverity } from '../../../../providers/ror2/logging/LoggerProvider';
import { splitArguments, startProcess } from '../../../../utils/ProcessUtils';
import GameInstructions from '../../instructions/GameInstructions';
import GameInstructionParser from '../../instructions/GameInstructionParser';
import GameDirectoryResolverProvider from '../../../../providers/ror2/game/GameDirectoryResolverProvider';

export default class SteamGameRunner_Darwin extends GameRunnerProvider {
    public async getGameArguments(game: Game, profile: Profile): Promise<string | R2Error> {
        const instructions = await GameInstructions.getInstructionsForGame(game, profile);
        return await GameInstructionParser.parse(instructions.moddedParameters, game, profile);
    }

    public async startModded(game: Game, profile: Profile): Promise<void | R2Error> {
        const args = await this.getGameArguments(game, profile);
        if (args instanceof R2Error) {
            return args
        }
        return this.start(game, args, 'modded', profile);
    }

    public async startVanilla(game: Game, profile: Profile): Promise<void | R2Error> {
        const instructions = await GameInstructions.getInstructionsForGame(game, profile);
        return this.start(game, instructions.vanillaParameters, 'vanilla', profile);
    }

    async start(game: Game, args: string, action: string, profile?: Profile): Promise<void | R2Error> {
        try {
            // New builds store the editable configuration in Contents/Resources.
            // Keep compatibility with the original fork's package-root location.
            const candidates = [
                path.resolve(path.dirname(process.execPath), '../Resources/games.json'),
                path.join(process.argv[0], '../../../../../../', 'games.json')
            ];
            let gameLauncher: unknown;
            for (const configPath of candidates) {
                if (!(await FsProvider.instance.exists(configPath))) continue;
                const config = JSON.parse((await FsProvider.instance.readFile(configPath)).toString());
                const details = Object.keys(config.games).map(key => config.games[key])
                    .find(details => details.meta.displayName === game.displayName);
                gameLauncher = details && details.r2modman.crossOverLauncher;
                break;
            }
            const profileName = profile && profile.getProfileName();
            const gameId = String(game.activePlatform.storeIdentifier);
            if (!/^\d+$/.test(gameId)) throw new Error('Invalid Steam game identifier');
            if (gameLauncher !== undefined && gameLauncher !== null && gameLauncher !== '') {
                if (typeof gameLauncher !== 'string' || !path.isAbsolute(gameLauncher) || !gameLauncher.endsWith('.app')) {
                    throw new Error('crossOverLauncher must be an absolute path to a CrossOver .app launcher');
                }
                // The bottle helper uses hyphens/spaces as delimiters. Refuse names
                // it cannot represent correctly instead of silently switching profiles.
                if (action === 'modded' && (!profileName || !/^[a-zA-Z0-9][a-zA-Z0-9_.]*$/.test(profileName))) {
                    throw new Error('CrossOver profile names must use letters, numbers, underscores or dots. Rename this profile before launching.');
                }
                const executable = path.join(gameLauncher, 'Contents/MacOS/Menu Helper');
                if (!(await FsProvider.instance.exists(executable))) throw new Error('CrossOver launcher Menu Helper was not found');
                const argument = action === 'modded' ? `modded-${gameId}-${profileName}` : `vanilla-${gameId}`;
                LoggerProvider.instance.Log(LogSeverity.INFO, `Starting CrossOver launcher: ${executable}`);
                await startProcess(executable, [argument]);
                return;
            }
            if (game.displayName === 'Valheim') {
                const directory = await GameDirectoryResolverProvider.instance.getDirectory(game);
                if (directory instanceof R2Error) return directory;
                const nativeExecutable = path.join(directory, 'Valheim.app/Contents/MacOS/Valheim');
                if (await FsProvider.instance.exists(nativeExecutable)) {
                    const settings = await ManagerSettings.getSingleton(game);
                    const extraArgs = splitArguments(settings.getContext().gameSpecific.launchParameters || '');
                    if (action === 'vanilla') {
                        await startProcess(nativeExecutable, extraArgs, { cwd: directory });
                    } else {
                        if (!profile) throw new Error('No active mod profile');
                        const root = profile.getPathOfProfile();
                        const loader = path.join(root, 'doorstop_libs/libdoorstop_x64.dylib');
                        const preloader = path.join(root, 'BepInEx/core/BepInEx.Preloader.dll');
                        for (const file of [loader, preloader]) {
                            if (!(await FsProvider.instance.exists(file))) {
                                throw new Error('Install BepInExPack_Valheim 5.4.2351 in this profile before starting modded Valheim');
                            }
                        }
                        // arch strips DYLD variables, so set them in env after arch.
                        await startProcess('/usr/bin/arch', ['-x86_64', '/usr/bin/env',
                            `DYLD_INSERT_LIBRARIES=${loader}`, 'DOORSTOP_ENABLED=1',
                            `DOORSTOP_TARGET_ASSEMBLY=${preloader}`, 'DOORSTOP_IGNORE_DISABLED_ENV=0',
                            'SteamAppId=892970', nativeExecutable, ...extraArgs], { cwd: directory });
                    }
                    return;
                }
            }
            const settings = await ManagerSettings.getSingleton(game);
            let executable: string | undefined;
            for (const app of ['/Applications/Steam.app', path.join(homedir(), 'Applications/Steam.app')]) {
                const candidate = path.join(app, 'Contents/MacOS/steam_osx');
                if (await FsProvider.instance.exists(candidate)) { executable = candidate; break; }
            }
            if (!executable) throw new Error('Steam.app was not found in /Applications or ~/Applications');
            await startProcess(executable, ['-applaunch', gameId, ...splitArguments(args),
                ...splitArguments(settings.getContext().gameSpecific.launchParameters || '')]);
        } catch (error) {
            return new R2Error('Unable to start the game', (error as Error).message,
                'Check the game directory and CrossOver launcher configuration');
        }
    }
}
