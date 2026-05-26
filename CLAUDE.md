# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Vaulty** is a secure desktop password manager built with Vue 3 + TypeScript + Tauri. It runs as a native desktop app (Rust/Tauri backend, SQLite storage) with a browser fallback mode (IndexedDB). All passwords and metadata are AES-256 encrypted; the encryption key lives only in memory and is derived from the master password at login.

## Commands

```bash
npm run dev          # Frontend dev server only (localhost:3000, uses IndexedDB)
npm run tauri:dev    # Full desktop app with hot reload (use this for Tauri features)
npm run build        # Type-check (vue-tsc) + Vite bundle
npm run tauri:build  # Build Tauri desktop installers
npm run package      # Copy installers into releases/v{version}/
npm run preview      # Preview production build
```

No test runner is configured.

## Architecture

### Dual-Mode Operation

The app runs in two modes controlled by `src/utils/tauri.ts`:
- **Desktop**: Tauri + SQLite via `@tauri-apps/plugin-sql`
- **Web fallback**: IndexedDB via `src/services/browserDatabase.ts`

`App.vue` waits up to 10 seconds for `window.__TAURI__` on mount, then initializes accordingly. `src/services/database.ts` exports `getDatabase()` which returns the appropriate adapter — all business logic uses this abstraction and is platform-agnostic.

### Data Flow

Components → Pinia stores (`src/stores/`) → Services (`src/services/`) → Database/Encryption

Stores handle all state and call services for I/O. Components never touch services directly.

### Encryption Key Lifecycle

1. User enters master password → PBKDF2-SHA256 (100k iterations) → hash compared to stored hash
2. Same derivation produces an in-memory session key (`EncryptionService.deriveEncryptionKey`)
3. All sensitive fields (passwords, usernames, emails, sites) are AES-256 encrypted with this key
4. Key is cleared on logout or after 3 minutes of inactivity (tracked by `src/plugins/activityTracker.ts`)

### SQLite Schema

- `master_password` — single-row hashed+salted master password
- `password_owners` — user profiles/accounts; `sync_id TEXT` (UUID) added Sprint 4 for cross-device merge
- `password_entries` — individual credentials linked to owners; `sync_id TEXT` added Sprint 4
- `security_question` — hashed recovery answers
- `sync_metadata` — device ID and last sync timestamp
- `vault_identity` — Ed25519 vault keypair (public key + AES-encrypted private key); added Sprint 1
- `sync_peers` — known iroh peers (`node_id TEXT UNIQUE`, `label`, `last_seen`); added Sprint 3
- `revoked_peers` — blocked NodeIds (`node_id TEXT UNIQUE`, `revoked_at`); loaded into Rust HashSet on startup; added Sprint 6

### P2P Sync Architecture (Sprints 1–6 complete — see SPRINT.md)

The sync feature is being replaced with Anytype-style peer-to-peer sync using **iroh** (Rust QUIC library). Key design decisions:

- **Vault identity** = Ed25519 keypair, independent of master password. The public key (bs58) is the "sync code" users share to pair devices.
- **Private key storage** — AES-256-GCM encrypted with PBKDF2(master\_password, random\_salt, 100k iterations). All crypto in Rust; private key never returned to frontend.
- **SQLite always owned by TypeScript** — Rust commands return encrypted data; frontend persists via `tauri-plugin-sql`. Rust never opens a second SQLite connection.
- **Pending join** — `vault_identity.encrypted_secret = ''` means this device entered a sync code but P2P sync hasn't run yet. Sprint 4 fills it in.
- **iroh Endpoint** — bound in `init_endpoint()` (async, spawned from Tauri setup hook). Stored as `Arc<Mutex<Option<iroh::Endpoint>>>` in `SyncState`. Commands clone the `Arc` before async work to avoid holding the lock.
- **ALPN** — `b"vaulty-sync/1"`. Both sides must present this on connect/accept. Changing it is a breaking protocol change.
- **Connection ticket** — JSON-serialised `iroh::NodeAddr`. Users exchange once to pair devices (copy/paste). Not human-readable.
- **Known vs connected peers** — `sync_peers` SQLite table persists known peers across restarts. In-memory `SyncState.connected_peers` tracks live connections; repopulated via `sync://peer-connected` Tauri events as peers reconnect.
- **Data sync transport** — TypeScript owns all SQLite I/O. `push_sync_data(node_id, payload)` Rust command opens a QUIC uni-stream and writes the payload; the peer's `recv_loop` accepts it and emits `sync://data-received`. All merging happens in TypeScript (`syncProtocol.ts`).
- **Merge key** — `sync_id TEXT` (UUID) on `password_owners` and `password_entries`. Entries are merged by `sync_id`; owner resolution maps remote `owner.sync_id → local owner.id` so auto-increment IDs never conflict across devices.
- **Auto-sync** — on `sync://peer-connected`, the store calls `syncWithPeer` automatically. Manual "Sync Now" and "Sync All" are also available in SyncPanel.
- **LAN discovery** — iroh `discovery-local-network` feature enables built-in mDNS (`swarm-discovery`). Combined with `discovery_n0()` relay, peers are found on LAN without internet and across networks with internet.
- **Startup reconnect** — 2 s after login, `reconnectKnownPeers()` reads `sync_peers` and calls `reconnect_peer(nodeId)` in parallel for each. Rust dials with `NodeAddr::new(node_id)` and lets discovery resolve the address. Silently no-ops if peer is offline.
- **Background sync** — `startBackgroundSync(5min)` runs a `setInterval` that calls `syncAllPeers()` whenever peers are connected.

### App View State Machine (`src/App.vue`)

```
loading → first-launch → (new-vault) → login (setup) → show-sync-code → dashboard
                       → (join)      → dashboard (pending join, syncs in Sprint 4)
loading → login (returning user) → dashboard
```

### Rust sync module (`src-tauri/src/sync/`)

| File | Purpose |
|------|---------|
| `sync/mod.rs` | `SyncState` (iroh Endpoint + connected\_peers); `init_endpoint` binds + accept loop |
| `sync/identity.rs` | `generate_and_encrypt`, `verify_and_get_public_key`, `decrypt_signing_key` |
| `sync/peer.rs` | `VAULTY_SYNC_ALPN`, `PeerInfo`, `handle_incoming`, `register_peer` |
| `sync/commands.rs` | All Tauri commands: `generate_vault_keypair`, `verify_vault_identity`, `validate_sync_code`, `get_node_ticket`, `dial_peer`, `get_connected_peers`, `disconnect_peer`, `push_sync_data`, `reconnect_peer`, `add_revoked_peer`, `remove_revoked_peer`, `get_endpoint_ready` |

### Frontend sync files (`src/`)

| File | Purpose |
|------|---------|
| `services/vaultIdentity.ts` | `generateAndStore`, `storePendingJoin`, `validateSyncCode`, `isPendingJoin` |
| `services/syncPeers.ts` | `getKnownPeers`, `upsertPeer`, `updatePeerLastSeen`, `removePeer`, `setPeerLabel`; revocation: `getRevokedPeers`, `addRevokedPeer`, `removeRevokedPeer`, `isRevoked` |
| `services/syncProtocol.ts` | `buildSyncPayload(vaultPublicKey)` — reads SQLite, serialises payload; `mergeSyncPayload(raw)` — verifies vault key, merges received payload into local SQLite |
| `stores/sync.ts` | File-sync (legacy) + P2P: peer state, `syncWithPeer`, `syncAllPeers`, `revokeDevice`, `renamePeer`, `endpointReady`/`endpointChecked`, Tauri event listeners, `vaulty:sync-complete` DOM event |
| `components/FirstLaunch.vue` | New Vault / Join Existing choice + join form |
| `components/SyncCode.vue` | Reusable copyable sync code display (`prominent` prop for first-setup) |
| `components/SyncPanel.vue` | Sync code, Connected Devices (live), Managed Devices (rename/revoke), Add Device, per-peer sync status, graceful degradation banner, file export/import (legacy) |

### Key Files

| File | Purpose |
|------|---------|
| `src/App.vue` | Initialization, environment detection, error handling |
| `src/stores/auth.ts` | Master password verification, session, inactivity timer |
| `src/stores/passwordOwners.ts` | CRUD for owners and entries |
| `src/services/encryption.ts` | AES-256 + PBKDF2 implementation (TypeScript side) |
| `src/services/database.ts` | SQLite/IndexedDB abstraction |
| `src-tauri/src/sync/identity.rs` | Vault keypair crypto (Rust) |
| `src-tauri/tauri.conf.json` | Window config, plugin registration, bundle settings |
| `vite.config.ts` | Build targets, Tauri dev server integration |

## Tauri Plugins in Use

`sqlite`, `fs`, `dialog` — configured in `src-tauri/tauri.conf.json` and loaded as `"sqlite:password_vault.db"`.

## TypeScript

Strict mode enabled via `tsconfig.app.json`. All components use `<script setup lang="ts">`. Database row types are in `src/types/index.ts`.
