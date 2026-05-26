use super::identity::{self, VaultKeypairData};
use super::peer::{register_peer, PeerInfo, VAULTY_SYNC_ALPN};
use tauri::Emitter;

/// Validate that a sync code is a properly-encoded Ed25519 public key (32 bytes, bs58).
/// Used on the join form to reject obviously wrong codes before attempting a connection.
#[tauri::command]
pub fn validate_sync_code(code: String) -> bool {
    match bs58::decode(code.trim()).into_vec() {
        Ok(bytes) => bytes.len() == 32,
        Err(_) => false,
    }
}

/// Generate a new Ed25519 vault keypair encrypted with the master password.
#[tauri::command]
pub fn generate_vault_keypair(master_password: String) -> Result<VaultKeypairData, String> {
    identity::generate_and_encrypt(&master_password)
}

/// Verify the master password against the stored encrypted vault keypair.
/// Returns the vault public key (bs58) on success.
#[tauri::command]
pub fn verify_vault_identity(
    master_password: String,
    encrypted_secret: String,
    kdf_salt: String,
    aes_nonce: String,
) -> Result<String, String> {
    identity::verify_and_get_public_key(&master_password, &encrypted_secret, &kdf_salt, &aes_nonce)
}

// ── Sprint 3: P2P connection commands ────────────────────────────────────────

/// Return this device's iroh connection ticket (JSON-serialised NodeAddr).
#[tauri::command]
pub async fn get_node_ticket(
    state: tauri::State<'_, super::SyncState>,
) -> Result<String, String> {
    let ep = {
        let lock = state.endpoint.lock().await;
        lock.as_ref()
            .ok_or_else(|| "P2P sync not initialised — check network connectivity".to_string())?
            .clone()
    };

    let addr = ep.node_addr().await.map_err(|e| e.to_string())?;
    serde_json::to_string(&addr).map_err(|e| e.to_string())
}

/// Dial another device using their connection ticket (JSON-serialised NodeAddr).
#[tauri::command]
pub async fn dial_peer(
    ticket: String,
    state: tauri::State<'_, super::SyncState>,
    app: tauri::AppHandle,
) -> Result<PeerInfo, String> {
    let node_addr: iroh::NodeAddr =
        serde_json::from_str(&ticket).map_err(|e| format!("Invalid ticket: {e}"))?;

    let ep = {
        let lock = state.endpoint.lock().await;
        lock.as_ref()
            .ok_or_else(|| "P2P sync not initialised".to_string())?
            .clone()
    };

    let conn = ep
        .connect(node_addr, VAULTY_SYNC_ALPN)
        .await
        .map_err(|e| format!("Connection failed: {e}"))?;

    let remote_id = conn
        .remote_node_id()
        .map_err(|e| format!("Could not read remote NodeId: {e}"))?;

    let peer = PeerInfo {
        node_id: remote_id.to_string(),
        connected_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };

    register_peer(&peer, conn, &app).await;
    Ok(peer)
}

/// Return all currently connected peers (in-memory, resets on restart).
#[tauri::command]
pub async fn get_connected_peers(
    state: tauri::State<'_, super::SyncState>,
) -> Result<Vec<PeerInfo>, String> {
    Ok(state.connected_peers.lock().await.clone())
}

/// Remove a peer from the connected list and emit `sync://peer-disconnected`.
#[tauri::command]
pub async fn disconnect_peer(
    node_id: String,
    state: tauri::State<'_, super::SyncState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    state
        .connected_peers
        .lock()
        .await
        .retain(|p| p.node_id != node_id);

    state.connections.lock().await.remove(&node_id);

    app.emit("sync://peer-disconnected", &node_id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Sprint 5: Reconnect to a known peer using only their NodeId ───────────────

/// Attempt to reconnect to a previously paired peer using their NodeId string.
/// Unlike `dial_peer`, this takes only the NodeId (no full ticket) — iroh's
/// local-network mDNS discovery and n0 relay discovery resolve their addresses.
/// Silently returns Ok(false) if the peer is unreachable; only errors on
/// internal failures (bad NodeId format, endpoint not ready).
#[tauri::command]
pub async fn reconnect_peer(
    node_id: String,
    state: tauri::State<'_, super::SyncState>,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    // Skip if already connected
    if state.connections.lock().await.contains_key(&node_id) {
        return Ok(true);
    }

    let peer_id: iroh::NodeId = node_id
        .parse()
        .map_err(|e| format!("Invalid NodeId: {e}"))?;

    let ep = {
        let lock = state.endpoint.lock().await;
        lock.as_ref()
            .ok_or_else(|| "P2P sync not initialised".to_string())?
            .clone()
    };

    match ep
        .connect(iroh::NodeAddr::new(peer_id), VAULTY_SYNC_ALPN)
        .await
    {
        Ok(conn) => {
            let peer = super::peer::PeerInfo {
                node_id: node_id.clone(),
                connected_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            };
            super::peer::register_peer(&peer, conn, &app).await;
            Ok(true)
        }
        Err(e) => {
            eprintln!("[vaulty-sync] Reconnect to {node_id} failed: {e}");
            Ok(false)
        }
    }
}

// ── Sprint 4: Data sync commands ──────────────────────────────────────────────

/// Push a JSON sync payload to a connected peer over a unidirectional QUIC stream.
/// The payload is read by the peer's recv_loop and re-emitted as `sync://data-received`.
#[tauri::command]
pub async fn push_sync_data(
    node_id: String,
    payload: String,
    state: tauri::State<'_, super::SyncState>,
) -> Result<(), String> {
    let conn = {
        let conns = state.connections.lock().await;
        conns
            .get(&node_id)
            .ok_or_else(|| format!("No active connection for peer {node_id}"))?
            .clone()
    };

    let mut send = conn
        .open_uni()
        .await
        .map_err(|e| format!("Failed to open stream: {e}"))?;

    send.write_all(payload.as_bytes())
        .await
        .map_err(|e| format!("Failed to write payload: {e}"))?;

    send.finish().map_err(|e| format!("Failed to finish stream: {e}"))?;

    Ok(())
}

// ── Sprint 6: Device revocation & health ──────────────────────────────────────

/// Add a NodeId to the in-memory revoked set.
/// Incoming connections from this NodeId will be rejected without completing the handshake.
/// TypeScript is responsible for persisting the revocation to the `revoked_peers` SQLite table
/// and calling this command both on revocation and on app startup (to reload the list).
#[tauri::command]
pub async fn add_revoked_peer(
    node_id: String,
    state: tauri::State<'_, super::SyncState>,
) -> Result<(), String> {
    state.revoked_peers.lock().await.insert(node_id.clone());

    // Also disconnect the peer if currently connected
    state.connected_peers.lock().await.retain(|p| p.node_id != node_id);
    state.connections.lock().await.remove(&node_id);

    Ok(())
}

/// Remove a NodeId from the in-memory revoked set (if the user un-revokes a device).
#[tauri::command]
pub async fn remove_revoked_peer(
    node_id: String,
    state: tauri::State<'_, super::SyncState>,
) -> Result<(), String> {
    state.revoked_peers.lock().await.remove(&node_id);
    Ok(())
}

/// Returns true if the iroh endpoint has been successfully initialised.
/// Used by the frontend to show a graceful degradation banner.
#[tauri::command]
pub async fn get_endpoint_ready(
    state: tauri::State<'_, super::SyncState>,
) -> Result<bool, String> {
    Ok(state.endpoint.lock().await.is_some())
}
