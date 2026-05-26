use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

/// ALPN identifier — both sides must present this when connecting/accepting.
/// Changing this value is a breaking protocol change.
pub const VAULTY_SYNC_ALPN: &[u8] = b"vaulty-sync/1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    /// iroh NodeId as a string (base32)
    pub node_id: String,
    /// Unix timestamp when the connection was established
    pub connected_at: u64,
}

/// Handle an incoming iroh connection from another Vaulty instance.
/// Called from the accept loop in sync/mod.rs.
pub async fn handle_incoming(
    incoming: iroh::endpoint::Incoming,
    app: tauri::AppHandle,
) -> anyhow::Result<()> {
    let conn = incoming
        .await
        .context("failed to complete incoming QUIC handshake")?;

    let remote_id = conn
        .remote_node_id()
        .context("could not read remote NodeId")?;

    // Reject connections from revoked peers
    {
        let state: tauri::State<super::SyncState> = app.state();
        if state
            .revoked_peers
            .lock()
            .await
            .contains(&remote_id.to_string())
        {
            eprintln!("[vaulty-sync] Rejected connection from revoked peer {remote_id}");
            conn.close(0u8.into(), b"revoked");
            return Ok(());
        }
    }

    let peer = PeerInfo {
        node_id: remote_id.to_string(),
        connected_at: unix_now(),
    };

    register_peer(&peer, conn, &app).await;
    Ok(())
}

/// Record a peer as connected, store the live connection, notify the frontend,
/// and start a background loop to receive incoming sync data streams.
pub async fn register_peer(
    peer: &PeerInfo,
    conn: iroh::endpoint::Connection,
    app: &tauri::AppHandle,
) {
    let state: tauri::State<super::SyncState> = app.state();

    // Update peer list
    {
        let mut guard = state.connected_peers.lock().await;
        guard.retain(|p| p.node_id != peer.node_id);
        guard.push(peer.clone());
    }

    // Store the live connection
    {
        let mut conns = state.connections.lock().await;
        conns.insert(peer.node_id.clone(), conn.clone());
    }

    if let Err(e) = app.emit("sync://peer-connected", peer) {
        eprintln!("[vaulty-sync] Failed to emit peer-connected event: {e}");
    }

    // Spawn a background task to accept incoming sync-data streams from this peer
    let node_id = peer.node_id.clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        recv_loop(conn, node_id, app_clone).await;
    });
}

/// Accept unidirectional streams from the peer and emit `sync://data-received`
/// for each one. Runs until the connection closes.
async fn recv_loop(conn: iroh::endpoint::Connection, node_id: String, app: tauri::AppHandle) {
    loop {
        let mut recv = match conn.accept_uni().await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[vaulty-sync] Peer {node_id} recv loop ended: {e}");
                // Remove peer from connected list and emit disconnected event
                let state: tauri::State<super::SyncState> = app.state();
                state
                    .connected_peers
                    .lock()
                    .await
                    .retain(|p| p.node_id != node_id);
                state.connections.lock().await.remove(&node_id);
                let _ = app.emit("sync://peer-disconnected", &node_id);
                break;
            }
        };

        let node_id = node_id.clone();
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            // 10 MB cap — sufficient for any reasonable vault size
            match recv.read_to_end(10 * 1024 * 1024).await {
                Ok(bytes) => match String::from_utf8(bytes) {
                    Ok(payload) => {
                        let event = json!({ "node_id": node_id, "payload": payload });
                        if let Err(e) = app.emit("sync://data-received", event) {
                            eprintln!("[vaulty-sync] Failed to emit data-received: {e}");
                        }
                    }
                    Err(e) => eprintln!("[vaulty-sync] Non-UTF8 payload from {node_id}: {e}"),
                },
                Err(e) => eprintln!("[vaulty-sync] Failed to read stream from {node_id}: {e}"),
            }
        });
    }
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
