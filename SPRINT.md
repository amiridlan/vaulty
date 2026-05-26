# P2P Sync Feature — Sprint Plan

Replacing the manual file-based export/import sync with Anytype-style P2P sync using **iroh** (Rust QUIC library). Devices discover each other via mDNS on LAN, or connect via QUIC hole-punching / relay fallback across networks. All vault data remains end-to-end encrypted; no server ever sees plaintext.

---

## Architecture Recap

```
[Device A: Tauri Rust]                    [Device B: Tauri Rust]
  iroh Endpoint (vault keypair)  ←──────   iroh Endpoint (vault keypair)
  SQLite ←── merge encrypted rows ───────  SQLite
  Vue frontend ← Tauri commands            Vue frontend
```

- **Vault identity** = Ed25519 keypair (generated once, stored encrypted in SQLite)
- **Sync code** = base58 of vault public key — shared once to pair devices
- **Data in transit** = already AES-256 encrypted rows, wrapped in iroh QUIC transport encryption
- **Conflict resolution** = last-write-wins by `updated_at` timestamp (sufficient for single-user vault)

---

## Post-Sprint Checklist (run after EVERY sprint)

After completing each sprint, before marking it done:

- [ ] Review `.gitignore` — check for new build artifacts, temp files, or sensitive files that need ignoring
- [ ] Update sprint checklist below (mark completed tasks ✅, note any carry-overs)
- [ ] Update `README.md` — reflect any new setup steps, commands, or user-facing features
- [ ] Update `CLAUDE.md` — reflect any architecture changes, new files, or new commands

---

## Pre-Sprint Fix (before Sprint 1)

**Known `.gitignore` issue:** `CLAUDE.md` is currently listed in `.gitignore`. This file should be committed — remove it from `.gitignore` before starting Sprint 1.

✅ **Done** — `CLAUDE.md` removed from `.gitignore`. Also fixed: `Cargo.lock` is no longer ignored (binary apps should commit it for reproducible builds).

---

## Sprint 1 — Rust Foundation & Vault Identity ✅ COMPLETE

**Goal:** Vault identity crypto layer wired into Tauri. Each device can generate an Ed25519 vault keypair, encrypt it with the master password, and store it in SQLite. No UI changes yet.

> **Note:** `iroh` (networking) deferred to Sprint 3 — only vault identity crypto is needed here. `SyncState` added as a placeholder struct. This keeps Sprint 1 compile time fast.

**Backend (src-tauri/):**
- ✅ Add dependencies to `Cargo.toml`: `ed25519-dalek`, `aes-gcm`, `pbkdf2`, `sha2`, `rand`, `hex`, `bs58` (iroh commented out, added in Sprint 3)
- ✅ Create `src-tauri/src/sync/mod.rs` — `SyncState` placeholder struct; iroh Endpoint slot reserved for Sprint 3
- ✅ Create `src-tauri/src/sync/identity.rs` — `generate_and_encrypt()`, `verify_and_get_public_key()`, `decrypt_signing_key()` using AES-256-GCM + PBKDF2-SHA256 (100k iterations)
- ✅ Create `src-tauri/src/sync/commands.rs` — two Tauri commands:
  - `generate_vault_keypair(master_password) -> VaultKeypairData` — returns encrypted data for frontend to store
  - `verify_vault_identity(master_password, encrypted_secret, kdf_salt, aes_nonce) -> String` — returns public key on success
- ✅ Wire commands into `main.rs`

**Database:**
- ✅ Add `vault_identity` table migration in `src/services/database.ts`
- ✅ Fixed: removed duplicate `master_password` table creation that existed in original code

**Post-Sprint:**
- ✅ `.gitignore` review — `src-tauri/target` already covers all Rust artifacts; fixed `Cargo.lock` to be committed (reproducible builds); removed `CLAUDE.md`
- ✅ Updated sprint checklist (this section)
- ✅ `README.md` updated
- ✅ `CLAUDE.md` updated

---

## Sprint 2 — First Launch & Vault Pairing UX ✅ COMPLETE

**Goal:** New device shows "New Vault / Join Existing Vault" choice. After setup, sync code is shown and always accessible in SyncPanel.

> **Note:** `generate_sync_ticket` (iroh ticket) deferred to Sprint 3 — only format validation needed here. QR code display deferred; copyable text is sufficient for now.

**Frontend:**
- ✅ Create `src/components/FirstLaunch.vue` — choice screen + join form (sync code + password + confirm)
- ✅ Create `src/components/SyncCode.vue` — copyable sync code display, reusable (`prominent` prop for first-setup emphasis)
- ✅ Create `src/services/vaultIdentity.ts` — `generateAndStore`, `storePendingJoin`, `validateSyncCode`, `isPendingJoin`
- ✅ Update `src/App.vue` — explicit `AppView` state machine: `loading | error | first-launch | login | show-sync-code | dashboard`
- ✅ Update `src/components/Login.vue` — emit `vault-created` after setup (triggers sync code screen); emit `authenticated` after normal login
- ✅ Update `src/components/SyncPanel.vue` — loads vault identity on mount, shows `SyncCode` + pending-join banner

**Backend:**
- ✅ `validate_sync_code(code: String) -> bool` — checks bs58 decodes to 32 bytes (Ed25519 public key)

**Join Flow (Sprint 2 scope):**
- User enters sync code + master password → `storePendingJoin` saves vault_public_key with empty encrypted_secret
- Pending state shown in SyncPanel: "Waiting to sync with original device"
- Actual P2P connection in Sprint 3

**Post-Sprint:**
- ✅ `.gitignore` review — no new artifacts
- ✅ Updated sprint checklist (this section)
- ✅ `README.md` updated
- ✅ `CLAUDE.md` updated

---

## Sprint 3 — P2P Connection & Device Pairing ✅ COMPLETE

**Goal:** Two devices can establish an iroh P2P connection using the sync code. Connection works on LAN and across networks (relay fallback).

**Backend:**
- ✅ `src-tauri/src/sync/peer.rs` — `VAULTY_SYNC_ALPN`, `PeerInfo`, `handle_incoming`, `register_peer`
- ✅ `src-tauri/src/sync/mod.rs` — iroh `Endpoint` in `SyncState`; `init_endpoint` binds + accept loop
- ✅ `src-tauri/src/sync/commands.rs` — `get_node_ticket`, `dial_peer`, `get_connected_peers`, `disconnect_peer`
- ✅ `src-tauri/src/main.rs` — manages `SyncState`; spawns `init_endpoint` in setup hook
- ✅ Fixed missing `use tauri::{Emitter, Manager}` trait imports; `cargo check` passes

**Database:**
- ✅ `sync_peers` table added to `src/services/database.ts`:
  - `node_id TEXT NOT NULL UNIQUE`, `label TEXT`, `last_seen INTEGER`

**Frontend:**
- ✅ `src/services/syncPeers.ts` — `getKnownPeers`, `upsertPeer`, `updatePeerLastSeen`, `removePeer`, `setPeerLabel`
- ✅ `src/stores/sync.ts` — peer state + Tauri event listeners (`sync://peer-connected`, `sync://peer-disconnected`); `loadNodeTicket`, `dialPeer`, `disconnectPeer`, `refreshConnectedPeers`
- ✅ `src/components/SyncPanel.vue` — Connected Devices list (live status dot + disconnect button) + Add Device section (show own ticket / paste peer ticket + Connect)

> **Connection ticket format:** JSON-serialised `iroh::NodeAddr` (includes relay hints + direct socket addresses). Users exchange these once to pair. Not human-readable — copy/paste only.

> **Known peers vs connected peers:** `sync_peers` SQLite table persists known peers across restarts. In-memory `SyncState.connected_peers` tracks live connections (resets on app restart); repopulated via `sync://peer-connected` events when peers reconnect.

**Post-Sprint:**
- ✅ `.gitignore` review — no new artifacts to exclude
- ✅ Updated sprint checklist (this section)
- ✅ `README.md` updated
- ✅ `CLAUDE.md` updated

---

## Sprint 4 — Data Sync Protocol ✅ COMPLETE

**Goal:** Connected peers actually exchange and merge vault data. `master_password` table syncs on first join. Auto-sync triggers on peer connect.

> **Architecture decision:** The sync protocol lives in TypeScript (not a separate `protocol.rs`) because SQLite is owned by the TypeScript layer. Rust provides only the QUIC transport (`push_sync_data` command + `sync://data-received` event).

**Backend:**
- ✅ `sync/mod.rs` — `SyncState.connections: HashMap<String, iroh::endpoint::Connection>` (stores live connections)
- ✅ `sync/peer.rs` — `register_peer` now stores the connection; `recv_loop` spawned per peer (accepts uni-streams, emits `sync://data-received`)
- ✅ `sync/commands.rs` — `push_sync_data(node_id, payload)` opens a QUIC unidirectional stream and writes the payload; auto-disconnects detected via recv_loop errors
- ✅ Auto-trigger: TypeScript's `sync://peer-connected` handler calls `syncWithPeer` automatically

**Schema:**
- ✅ `sync_id TEXT` added to `password_owners` and `password_entries` (UUID, generated client-side)
- ✅ ALTER TABLE migration is idempotent (try/catch) + backfills existing rows via `lower(hex(randomblob(16)))`
- ✅ New records always get a `sync_id` via `crypto.randomUUID()`

**Frontend:**
- ✅ `src/services/syncProtocol.ts` — `buildSyncPayload(vaultPublicKey)` + `mergeSyncPayload(raw)`:
  - Merge strategy: `sync_id` is the cross-device identity key for both owners and entries
  - `master_password` synced only if local has none (pending-join device receives the real hash)
  - `password_owners` merged by `sync_id`, last-write-wins by `updated_at`
  - `password_entries` merged by `sync_id` with owner resolved via `sync_id → local id` mapping
- ✅ `src/stores/sync.ts` — `syncWithPeer`, `syncAllPeers`, `setVaultPublicKey`; auto-sync on `sync://peer-connected`; merges on `sync://data-received`; dispatches `vaulty:sync-complete` custom DOM event
- ✅ `src/App.vue` — calls `syncStore.setVaultPublicKey` after vault creation and after login
- ✅ `src/components/SyncPanel.vue` — per-peer sync status (last synced time, records added/updated), "Sync Now" per device, "Sync All" button, reloads vault data on `vaulty:sync-complete`

**Post-Sprint:**
- ✅ `.gitignore` review — no new artifacts
- ✅ Updated sprint checklist (this section)
- ✅ `README.md` updated
- ✅ `CLAUDE.md` updated

---

## Sprint 5 — LAN Auto-Discovery & Background Sync ✅ COMPLETE

**Goal:** Devices on the same LAN find each other automatically without needing to manually enter a sync code again (after first pairing). Sync runs in the background silently.

> **Architecture decision:** No separate `discovery.rs` needed — iroh 0.35 provides `discovery_local_network()` (built-in mDNS via `swarm-discovery`) and `discovery_n0()` (relay-based, for cross-network). Both are enabled on the endpoint. The `reconnect_peer` command dials with just a NodeId string; iroh's discovery resolves the current address automatically.

**Backend:**
- ✅ `iroh` feature `discovery-local-network` enabled in `Cargo.toml`
- ✅ `sync/mod.rs` — `.discovery_local_network()` added alongside `.discovery_n0()` in endpoint builder
- ✅ `sync/commands.rs` — `reconnect_peer(node_id: String) -> Result<bool, String>`:
  - Parses NodeId from string, creates `iroh::NodeAddr::new(peer_id)`
  - Connects via discovery (LAN mDNS or relay), silently returns `Ok(false)` if peer offline
  - Skips if already connected

**Frontend:**
- ✅ `stores/sync.ts` — `reconnectKnownPeers()` reads `sync_peers` table, fires parallel reconnect attempts; `startBackgroundSync(intervalMs)` / `stopBackgroundSync()` for 5-minute periodic sync
- ✅ `App.vue` — calls `reconnectKnownPeers()` + `startBackgroundSync()` 2 s after login / join (gives iroh endpoint time to bind and register with relay)
- ✅ `SyncPanel.vue`:
  - Sync status chip (connected count / syncing / no devices)
  - "Reconnect" button when no peers connected
  - File export/import collapsed into a "Legacy" toggle (hidden by default)

**Post-Sprint:**
- ✅ `.gitignore` review — no new artifacts
- ✅ Updated sprint checklist (this section)
- ✅ `README.md` updated
- ✅ `CLAUDE.md` updated

---

## Sprint 6 — Polish, Edge Cases & Security Hardening ✅ COMPLETE

**Goal:** Production-ready sync. Device revocation, vault identity verification, graceful degradation, managed devices UI.

**Backend:**
- ✅ Device revocation — `add_revoked_peer(node_id)` / `remove_revoked_peer(node_id)` commands; `SyncState.revoked_peers: HashSet<String>` blocks incoming connections from revoked NodeIds immediately; `handle_incoming` closes with `conn.close(0, b"revoked")`
- ✅ Vault identity verification — `mergeSyncPayload` checks `payload.vault_public_key === localIdentity.vault_public_key`; rejects data from a different vault (pending-join devices bypass check until they have an `encrypted_secret`)
- ✅ Endpoint health — `get_endpoint_ready() -> bool` command; app stores `endpointReady` / `endpointChecked` state
- ✅ Revocation persistence — `revoked_peers` SQLite table; loaded into Rust `HashSet` on app startup via `loadRevokedPeersIntoRust()`

**Frontend:**
- ✅ Managed Devices section in `SyncPanel.vue` — shows ALL known peers (online + offline) with online indicator, rename (inline edit), revoke (inline confirm)
- ✅ Graceful degradation banner — shown when `endpointChecked && !endpointReady`; auto-expands legacy file sync
- ✅ `stores/sync.ts` — `revokeDevice`, `renamePeer`, `loadEndpointStatus`, `loadRevokedPeersIntoRust`, `endpointReady`, `endpointChecked` exported; `initialize()` calls revocation + endpoint load on startup; `initPeerListeners` handles `sync://endpoint-ready` / `sync://endpoint-failed` events

> **Deferred:** Offline sync queue (not needed — auto-sync on reconnect is sufficient), conflict logging UI, pairing approval modal (auto-accept is correct for trusted personal devices).

**Final Post-Sprint:**
- ✅ `.gitignore` audit — no new artifacts
- ✅ Updated sprint checklist (this section)
- ✅ `README.md` updated
- ✅ `CLAUDE.md` updated

---

## File Map (new files to be created)

```
src-tauri/src/
├── main.rs                    (modified — register commands, init sync state)
└── sync/
    ├── mod.rs                 (iroh Endpoint init, app state)
    ├── identity.rs            (vault keypair generation & storage)
    ├── peer.rs                (connection management, known peers)
    ├── protocol.rs            (data sync over QUIC streams)
    ├── discovery.rs           (mDNS LAN auto-discovery)
    └── commands.rs            (all Tauri commands)

src/
├── components/
│   ├── FirstLaunch.vue        (new vault vs join vault screen)
│   ├── SyncCode.vue           (sync code display + QR)
│   └── SyncPanel.vue          (modified — P2P peer list, status)
├── stores/
│   └── sync.ts                (modified — P2P state, peer events)
└── services/
    └── sync.ts                (modified — keep merge logic, remove file UI)
```

---

## Dependencies to Add

**Rust (`src-tauri/Cargo.toml`):**
```toml
iroh = "0.35"
tokio = { version = "1", features = ["full"] }
bs58 = "0.5"
mdns-sd = "0.11"
serde = { version = "1", features = ["derive"] }   # already present
```

**npm (`package.json`):**
```
qrcode  (QR code generation for sync code display)
```

---

## Sprint Status

| Sprint | Title | Status |
|--------|-------|--------|
| Pre-fix | Fix CLAUDE.md in .gitignore | ✅ Complete |
| 1 | Rust Foundation & Vault Identity | ✅ Complete |
| 2 | First Launch & Vault Pairing UX | ✅ Complete |
| 3 | P2P Connection & Device Pairing | ✅ Complete |
| 4 | Data Sync Protocol | ✅ Complete |
| 5 | LAN Auto-Discovery & Background Sync | ✅ Complete |
| 6 | Polish, Edge Cases & Security Hardening | ✅ Complete |
