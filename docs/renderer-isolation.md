# Renderer isolation migration

The renderer currently uses Node integration, Node integration in workers, disabled context isolation, and disabled web security. This first step prepares a small API boundary; it does not yet provide a sandbox or remove renderer Node privileges.

## Access inventory

| Area | Current access | Migration work remaining |
| --- | --- | --- |
| Startup and updater | Startup metadata and updater setup now use named preload requests | Completed; metadata preserves existing portability rules |
| User interactions | Clipboard/restart use named preload requests; install subscriptions pass only strings and return cleanup functions | Completed; shell actions remain separate |
| Native pickers | File and folder selection now use `window.r2modmanDialogs` | Completed: two named invoke methods, main-frame authorization and validated options |
| External links and file reveal | `LinkImpl` calls Electron shell; `EgsGameRunner` opens a launcher link | Constrained URL schemes and file-reveal API |
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

Updater setup preserves the macOS opt-out and existing Windows/Linux policy. Its promise acknowledges setup, not completion of an update download; check failures are logged without blocking catalog loading. Startup and clipboard consumers await responses and report failures. No renderer module uses raw Electron IPC after this migration; the two direct Electron imports still remaining use `shell` for external links/file reveal and Epic launching.

Run `node test/security/lifecycle-bridge.js` for method routing, sender/payload validation, notification filtering and disposal. Restart behavior is unit-tested with mocked app services; tests do not restart the user's machine.
