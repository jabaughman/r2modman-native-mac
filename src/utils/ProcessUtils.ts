import { spawn, SpawnOptions } from 'child_process';

/** Parse quoted command-line arguments, without shell expansion or execution. */
export function splitArguments(input: string): string[] {
    const result: string[] = [];
    let word = '', quote = '', started = false;
    for (let i = 0; i < input.length; i++) {
        const character = input[i];
        if (character === '\\' && quote !== "'") {
            if (++i >= input.length) throw new Error('Trailing escape in launch arguments');
            word += input[i]; started = true;
        } else if (quote) {
            if (character === quote) quote = '';
            else word += character;
        } else if (character === '"' || character === "'") {
            quote = character; started = true;
        } else if (/\s/.test(character)) {
            if (started) result.push(word);
            word = ''; started = false;
        } else {
            word += character; started = true;
        }
    }
    if (quote) throw new Error('Unclosed quote in launch arguments');
    if (started) result.push(word);
    return result;
}

/** Return once the launcher starts, without blocking on the running game. */
export function startProcess(executable: string, args: string[], options: SpawnOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { ...options, shell: false, detached: true, stdio: 'ignore' });
        child.once('error', reject);
        child.once('spawn', () => { child.unref(); resolve(); });
    });
}
