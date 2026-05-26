pub mod commands;
pub mod identity;
pub mod peer;

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;

pub use peer::PeerInfo;

pub struct SyncState {
    /// The iroh Endpoint — None until init_endpoint() completes.
    pub endpoint: Arc<Mutex<Option<iroh::Endpoint>>>,
    /// In-memory list of currently connected peers (metadata only).
    pub connected_peers: Arc<Mutex<Vec<PeerInfo>>>,
    /// Live connections keyed by NodeId string — used to open new streams for data sync.
    pub connections: Arc<Mutex<HashMap<String, iroh::endpoint::Connection>>>,
    /// NodeIds that have been revoked. Incoming connections from these are rejected immediately.
    pub revoked_peers: Arc<Mutex<HashSet<String>>>,
}

impl SyncState {
    pub fn new() -> Self {
        Self {
            endpoint: Arc::new(Mutex::new(None)),
            connected_peers: Arc::new(Mutex::new(Vec::new())),
            connections: Arc::new(Mutex::new(HashMap::new())),
            revoked_peers: Arc::new(Mutex::new(HashSet::new())),
        }
    }
}

/// Initialise the iroh Endpoint and start the accept loop.
/// Called from the Tauri setup hook; runs on Tauri's tokio runtime.
pub async fn init_endpoint(app: tauri::AppHandle) {
    use peer::VAULTY_SYNC_ALPN;

    let endpoint = match iroh::Endpoint::builder()
        .alpns(vec![VAULTY_SYNC_ALPN.to_vec()])
        .discovery_n0()
        .discovery_local_network()
        .bind()
        .await
    {
        Ok(ep) => ep,
        Err(e) => {
            eprintln!("[vaulty-sync] Failed to initialize iroh endpoint: {e}");
            app.emit("sync://endpoint-failed", e.to_string()).ok();
            return;
        }
    };

    {
        let state: tauri::State<SyncState> = app.state();
        *state.endpoint.lock().await = Some(endpoint.clone());
    }

    app.emit("sync://endpoint-ready", ()).ok();
    eprintln!(
        "[vaulty-sync] Endpoint ready. NodeId: {}",
        endpoint.node_id()
    );

    // Accept loop — runs until the endpoint closes (app exit)
    while let Some(incoming) = endpoint.accept().await {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = peer::handle_incoming(incoming, app).await {
                eprintln!("[vaulty-sync] Incoming connection error: {e}");
            }
        });
    }
}
