# r2modman Native Mac

An unofficial continuation of r2modman for macOS Apple Silicon, focused on native macOS game launching and keeping the manager compatible with recent Electron releases.

## Credits

This project builds on **m0dtheory’s original macOS Apple Silicon and CrossOver adaptation**, [r2modmanPlus-crossover](https://github.com/m0dtheory/r2modmanPlus-crossover). Credit for that foundational macOS work belongs to m0dtheory.

The original mod manager is **ebkr’s r2modmanPlus**. Its original MIT license and copyright attribution are preserved in LICENSE. This continuation adds native Valheim launching, restores directory validation, hardens archive extraction and process launching, and upgrades Electron for continued macOS support.

## What changed

- Electron 44.7.0, with compatibility fixes for clipboard calls and encoded file paths.
- Native macOS Valheim launching: modded play uses Rosetta and the profile's macOS Doorstop loader; vanilla play uses the game executable directly.
- Restored game-directory checks and failure reporting.
- ZIP traversal and symlink protections; process arguments passed without shell expansion.
- macOS automatic updates disabled to preserve this custom build.

## Build

Requires macOS, Node >=22.12.0 (tested with 24.21.0), Yarn 1.22.22, and Xcode Command Line Tools.

```sh
yarn install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
NODE_OPTIONS=--openssl-legacy-provider CSC_IDENTITY_AUTO_DISCOVERY=false yarn build-osx
```

The unsigned Apple Silicon app is produced at `dist/electron/Packaged/mac-arm64/r2modman.app`.

## Native Valheim

Install Rosetta if it is not already available. Select Valheim / Steam, set the game directory to Steam's Valheim folder, and install BepInExPack_Valheim 5.4.2351 in the selected profile. Use Start modded. Mods with custom shaders may need Mac-compatible asset bundles. The manager cannot fix those shader assets.

Do not update manually installed Mac mod replacements through the catalog unless the package includes the compatible build: a reinstall may replace them with the standard package.

## Validation and limits

Tested on Apple Silicon: UI startup, catalog refresh, configuration discovery, profile-code import (16 packages), uncached BepInEx download, and modded Valheim title-screen startup (15 plugins loaded, none failed). No world was opened for the Electron upgrade test. Windows/Linux builds remain untested.

```sh
node test/security/hardening.js
node test/security/valheim-launch.js
```

The legacy renderer still requires Node integration, disabled context isolation, and disabled web security. Updating Electron does not remove those architectural limitations. The existing Vue 2 / Quasar build toolchain also remains in place.

No personal profiles, saves, or downloaded third-party mod DLLs are included. Original documentation is retained in README-upstream.md. Inherited GitHub workflows are stored with `.disabled` suffixes pending review for this personal repository.

### Protecting manually installed Mac mod builds

After replacing a mod's files with an author-provided Mac build, expand that mod on the Installed page and select **Protect local files**. This saves the current plugin directory under the profile's `.local-overrides` directory and adds a **Local replacement protected** badge. Catalog installs, updates, local reinstalls, and uninstalls are blocked for that package until you select **Release protection**. Other mods can still be updated normally.

**Restore local backup** restores the saved plugin files and enables protection again. Enable a disabled mod before creating or restoring its backup. Release protection retains the backup; protecting again after release replaces it with a snapshot of the current files. These snapshots contain the replacement you protected, not an automatic copy of the original catalog package. Game saves and configuration files are outside this backup. Profile sharing does not transfer these local snapshots.
