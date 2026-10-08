# Renderer isolation migration

The renderer currently uses Node integration, Node integration in workers, disabled context isolation, and disabled web security. This first step prepares a small API boundary; it does not yet provide a sandbox or remove renderer Node privileges.

## Access inventory

| Area | Current access | Migration work remaining |
| --- | --- | --- |
| Startup and updater | Startup metadata and updater setup now use named preload requests | Completed; metadata preserves existing portability rules |
| User interactions | Clipboard/restart use named preload requests; install subscriptions pass only strings and return cleanup functions | Completed; shell actions remain separate |
| Native pickers | File and folder selection now use `window.r2modmanDialogs` | Completed: two named invoke methods, main-frame authorization and validated options |
| External links and file reveal | Named preload methods route web links, supported local config/folder opens, file reveal and Epic launching | Completed; schemes and launcher identifiers validated in main process |
| File reads/writes | `NodeFs`, `SafePaths`, `LocalModOverrides`, and `LocalModCard` use Node filesystem APIs | Main-process file service with profile/cache scope and path validation |
| Installation/import/export | Renderer services use filesystem, ZIP, YAML and package installers | Main-process operations with progress/results; retain traversal protection |
| Launching and discovery | `ProcessUtils`, platform runners and directory resolvers use child processes; resolvers and `Manager.vue` use OS paths | Named launch/discovery operations rather than arbitrary process execution |
| Network and catalog | Download/catalog providers and renderer network clients | Assess credential-free catalog traffic versus main-process downloads before enabling web security |
| Runtime globals | Renderer references `process`, `Buffer`, Node path APIs | Replace host metadata; move binary/ZIP handling before removing Node integration |

## First migration: native dialogs

The preload exposes only `selectFile(options)` and `selectFolder(options)`. It never exposes raw IPC, arbitrary channel names, Electron events, or a generic filesystem/process API. Main-process handlers authorize the active window's main frame and the expected app document, copy supported option fields, and set selection properties themselves. Invoke responses belong to each request, avoiding the old shared reply listener when dialogs overlap. Cancellation returns an empty path list.

Quasar copies `electron-preload.js` into packaged builds; development loads it from the project working directory. The preload uses `contextBridge` when context isolation is enabled and a frozen, non-writable window property during the current transition. No direct-IPC fallback exists in the picker provider.

## Next steps and verification

Migrate remaining Electron APIs, then filesystem/download/install/launch services. Enable context isolation and remove Node integration only when their renderer dependencies are gone. Assess web security separately against catalog requests and local mod icons. Each change should test startup, catalog/download, profile import/export, config editing, and supported game launching; platform-specific runners require their respective platforms.

Run `node test/security/dialog-bridge.js` for concurrent requests, cancellation, forged sender/frame rejection, option validation, and both preload exposure modes. Build and exercise the packaged file and folder pickers as a separate smoke test.

Reference: [Electron IPC guidance](https://www.electronjs.org/docs/latest/tutorial/ipc).

## Lifecycle and notifications migration

`r2modmanDesktop` exposes startup metadata, update setup, clipboard text writes, application restart, and an install-request subscription. Each request uses the same main-window/main-frame/document authorization as dialogs. Clipboard requests require a string of at most 16 MiB. Protocol transport is handled internally in the main process; only supported Thunderstore install strings are forwarded to the trusted app document. Renderer subscriptions never receive Electron events and are disposed when the manager view closes.

Updater setup preserves the macOS opt-out and existing Windows/Linux policy. Its promise acknowledges setup, not completion of an update download; check failures are logged without blocking catalog loading. Startup and clipboard consumers await responses and report failures. No renderer module uses raw Electron IPC after this migration; the shell migration below removes the remaining direct Electron imports.

Run `node test/security/lifecycle-bridge.js` for method routing, sender/payload validation, notification filtering and disposal. Restart behavior is unit-tested with mocked app services; tests do not restart the user's machine.

## Shell migration

`r2modmanShell` provides separate named methods for HTTP(S) links, local config/folder opens, file reveal, Steam verification, and Epic launching. All share trusted-window/frame/document authorization. Main-process handlers validate arguments and build launcher URLs from identifiers rather than accepting arbitrary protocol URLs. Epic protocol links use `openExternal` rather than `openPath`, matching [Electron shell documentation](https://www.electronjs.org/docs/latest/api/shell).

Local targets must exist and be absolute. Opening is limited to folders or the tool's supported config extensions (`.cfg`, `.txt`, `.json`, `.yml`, `.yaml`, `.ini`), checked after resolving symlinks. Revealing a file does not open it and accepts other extensions. Local-open errors returned by Electron are reported to the existing error UI. Renderer callers await shell requests; config filenames and directories containing spaces or URL punctuation use local paths without concatenating `file://` URLs. Unrelated custom schemes and executable-file opens are intentionally rejected.

Renderer source now has no direct Electron imports. Node filesystem, process, ZIP, network and runtime dependencies still prevent enabling full renderer isolation. Run `node test/security/shell-bridge.js` for routing, supported local targets, protocol/identifier validation, forged sender rejection, symlink-to-executable rejection and shell error propagation. Launcher dispatch is mocked; it does not start games or verify installations during tests.

## First filesystem migration: profile logs

Log availability polling and Copy LogOutput now use named main-process operations. Requests specify game folder, profile name and a supported loader; they cannot specify a filename. The main process chooses the existing BepInEx, MelonLoader/Northstar or ReturnOfModding log path, rejects traversal and symlinks, and copies text directly to the clipboard with the existing short-log code-fence formatting. Reads are bounded to 16 MiB and report missing/unsafe/oversized files through the existing error UI when copying. Unsupported loaders have no available log. Polling avoids overlapping requests and discards results after profile/game changes.

The existing renderer settings bootstrap the data root once after directory initialization. Root changes require an application restart, preserving the existing change-folder workflow and legacy custom roots without adding markers or editing preferences. This is a migration compatibility boundary: the root authority still originates in renderer IndexedDB and must move to main-owned settings before claiming independent root authorization or full isolation. Other filesystem and process services remain in the renderer.

Run `node test/security/profile-log-bridge.js` for supported-loader mappings, custom root initialization, formatting, missing logs, rejected scopes/symlinks, oversized logs and forged senders. Tests use temporary fixture logs and a mocked clipboard; no game logs are committed.
