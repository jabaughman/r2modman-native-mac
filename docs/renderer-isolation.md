# Renderer isolation migration

The renderer currently uses Node integration, Node integration in workers, disabled context isolation, and disabled web security. This first step prepares a small API boundary; it does not yet provide a sandbox or remove renderer Node privileges.

## Access inventory

| Area | Current access | Migration work remaining |
| --- | --- | --- |
| Startup and updater | `src/App.vue`, `src/pages/Splash.vue` use raw Electron IPC for app-data, portability, and update notifications | Named lifecycle methods and typed notifications |
| User interactions | `InteractionProviderImpl` uses Electron clipboard, restart IPC, and protocol events | Move clipboard/restart/protocol subscriptions; strip event objects from notifications |
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
