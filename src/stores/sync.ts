import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SyncService } from '../services/sync';
import {
  getKnownPeers,
  upsertPeer,
  updatePeerLastSeen,
  SyncPeerRow,
  addRevokedPeer,
  getRevokedPeers,
  setPeerLabel,
} from '../services/syncPeers';
import { buildSyncPayload, mergeSyncPayload, MergeResult } from '../services/syncProtocol';
import { isDesktopApp } from '../utils/tauri';

export interface PeerInfo {
  node_id: string;
  connected_at: number;
}

export interface SyncStatus {
  node_id: string;
  last_sync: number | null;
  last_result: MergeResult | null;
  error: string | null;
}

export const useSyncStore = defineStore('sync', () => {
  // ── File-based sync (legacy) ──────────────────────────────────────────────
  const isSyncing = ref(false);
  const lastSyncTime = ref<Date | null>(null);
  const syncError = ref('');

  async function initialize() {
    await SyncService.initializeSyncMetadata();
    await loadLastSyncTime();
    if (isDesktopApp()) {
      await loadKnownPeers();
      await loadRevokedPeersIntoRust();
      await loadEndpointStatus();
      initPeerListeners();
    }
  }

  async function loadLastSyncTime() {
    lastSyncTime.value = await SyncService.getLastSyncTime();
  }

  async function exportToFile(): Promise<string> {
    try {
      isSyncing.value = true;
      syncError.value = '';
      const filename = await SyncService.saveSyncFile();
      await loadLastSyncTime();
      return filename;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to export data. Please try again.';
      syncError.value = errorMessage;
      throw new Error(errorMessage);
    } finally {
      isSyncing.value = false;
    }
  }

  async function importFromFile(file: File): Promise<void> {
    try {
      isSyncing.value = true;
      syncError.value = '';
      await SyncService.loadSyncFile(file);
      await loadLastSyncTime();
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to import data. Please try again.';
      syncError.value = errorMessage;
      throw new Error(errorMessage);
    } finally {
      isSyncing.value = false;
    }
  }

  const formattedLastSync = computed(() => {
    if (!lastSyncTime.value) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.value.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  });

  // ── P2P peer management ───────────────────────────────────────────────────
  const connectedPeers = ref<PeerInfo[]>([]);
  const knownPeers = ref<SyncPeerRow[]>([]);
  const nodeTicket = ref('');
  const isLoadingTicket = ref(false);
  const peerError = ref('');
  const isConnecting = ref(false);
  const endpointReady = ref(false);
  const endpointChecked = ref(false);

  // ── P2P sync tracking ─────────────────────────────────────────────────────
  const syncStatuses = ref<Map<string, SyncStatus>>(new Map());
  const isSyncingPeer = ref(false);

  // Set by App.vue after login so we can include vaultPublicKey in payloads
  const vaultPublicKey = ref('');

  async function loadNodeTicket() {
    if (!isDesktopApp()) return;
    isLoadingTicket.value = true;
    peerError.value = '';
    try {
      nodeTicket.value = await invoke<string>('get_node_ticket');
    } catch (e: any) {
      peerError.value = e?.toString() ?? 'Failed to get connection ticket';
    } finally {
      isLoadingTicket.value = false;
    }
  }

  async function dialPeer(ticket: string): Promise<PeerInfo | null> {
    if (!isDesktopApp()) return null;
    isConnecting.value = true;
    peerError.value = '';
    try {
      const peer = await invoke<PeerInfo>('dial_peer', { ticket });
      await upsertPeer(peer.node_id);
      await loadKnownPeers();
      return peer;
    } catch (e: any) {
      peerError.value = e?.toString() ?? 'Connection failed';
      return null;
    } finally {
      isConnecting.value = false;
    }
  }

  async function disconnectPeer(nodeId: string) {
    if (!isDesktopApp()) return;
    try {
      await invoke('disconnect_peer', { nodeId });
    } catch (e: any) {
      peerError.value = e?.toString() ?? 'Failed to disconnect';
    }
  }

  async function loadKnownPeers() {
    knownPeers.value = await getKnownPeers();
  }

  async function revokeDevice(nodeId: string) {
    if (!isDesktopApp()) return;
    // Persist revocation and remove from known peers in SQLite
    await addRevokedPeer(nodeId);
    // Tell Rust to reject future connections and disconnect if active
    await invoke('add_revoked_peer', { nodeId });
    // Update connected peers list
    connectedPeers.value = connectedPeers.value.filter((p) => p.node_id !== nodeId);
    await loadKnownPeers();
  }

  async function renamePeer(nodeId: string, label: string) {
    if (!isDesktopApp()) return;
    await setPeerLabel(nodeId, label);
    await loadKnownPeers();
  }

  async function loadEndpointStatus() {
    if (!isDesktopApp()) return;
    try {
      endpointReady.value = await invoke<boolean>('get_endpoint_ready');
    } catch {
      endpointReady.value = false;
    }
    endpointChecked.value = true;
  }

  async function loadRevokedPeersIntoRust() {
    if (!isDesktopApp()) return;
    const revoked = await getRevokedPeers();
    await Promise.allSettled(
      revoked.map((r) => invoke('add_revoked_peer', { nodeId: r.node_id })),
    );
  }

  async function refreshConnectedPeers() {
    if (!isDesktopApp()) return;
    try {
      connectedPeers.value = await invoke<PeerInfo[]>('get_connected_peers');
    } catch {
      // non-fatal
    }
  }

  // ── Push this device's vault data to a connected peer ────────────────────
  async function syncWithPeer(nodeId: string): Promise<MergeResult | null> {
    if (!isDesktopApp() || !vaultPublicKey.value) return null;
    isSyncingPeer.value = true;
    const status = syncStatuses.value.get(nodeId) ?? {
      node_id: nodeId,
      last_sync: null,
      last_result: null,
      error: null,
    };
    try {
      const payload = await buildSyncPayload(vaultPublicKey.value);
      await invoke('push_sync_data', { nodeId, payload });
      status.last_sync = Math.floor(Date.now() / 1000);
      status.error = null;
      await updatePeerLastSeen(nodeId);
      await loadKnownPeers();
      syncStatuses.value.set(nodeId, { ...status });
      return status.last_result;
    } catch (e: any) {
      status.error = e?.toString() ?? 'Sync failed';
      syncStatuses.value.set(nodeId, { ...status });
      return null;
    } finally {
      isSyncingPeer.value = false;
    }
  }

  async function syncAllPeers() {
    for (const peer of connectedPeers.value) {
      await syncWithPeer(peer.node_id);
    }
  }

  // Called by App.vue after successful login so sync can include the vault key
  function setVaultPublicKey(key: string) {
    vaultPublicKey.value = key;
  }

  // ── Reconnect to known peers on startup ──────────────────────────────────
  async function reconnectKnownPeers() {
    if (!isDesktopApp()) return;
    const peers = await getKnownPeers();
    // Fire all reconnect attempts in parallel; each silently skips if offline
    await Promise.allSettled(
      peers.map((p) => invoke<boolean>('reconnect_peer', { nodeId: p.node_id })),
    );
  }

  // ── Background sync loop ─────────────────────────────────────────────────
  let bgSyncTimer: ReturnType<typeof setInterval> | null = null;

  function startBackgroundSync(intervalMs = 5 * 60 * 1000) {
    if (bgSyncTimer !== null) return;
    bgSyncTimer = setInterval(async () => {
      if (connectedPeers.value.length > 0 && vaultPublicKey.value) {
        await syncAllPeers();
      }
    }, intervalMs);
  }

  function stopBackgroundSync() {
    if (bgSyncTimer !== null) {
      clearInterval(bgSyncTimer);
      bgSyncTimer = null;
    }
  }

  function initPeerListeners() {
    listen<void>('sync://endpoint-ready', () => {
      endpointReady.value = true;
      endpointChecked.value = true;
    });

    listen<string>('sync://endpoint-failed', () => {
      endpointReady.value = false;
      endpointChecked.value = true;
    });

    listen<PeerInfo>('sync://peer-connected', async (event) => {
      const peer = event.payload;
      connectedPeers.value = connectedPeers.value.filter((p) => p.node_id !== peer.node_id);
      connectedPeers.value.push(peer);
      await upsertPeer(peer.node_id);
      await loadKnownPeers();

      // Auto-push our data to the newly connected peer
      if (vaultPublicKey.value) {
        await syncWithPeer(peer.node_id);
      }
    });

    listen<string>('sync://peer-disconnected', (event) => {
      const nodeId = event.payload;
      connectedPeers.value = connectedPeers.value.filter((p) => p.node_id !== nodeId);
    });

    listen<{ node_id: string; payload: string }>('sync://data-received', async (event) => {
      const { node_id, payload } = event.payload;
      const status = syncStatuses.value.get(node_id) ?? {
        node_id,
        last_sync: null,
        last_result: null,
        error: null,
      };
      try {
        const result = await mergeSyncPayload(payload);
        status.last_sync = Math.floor(Date.now() / 1000);
        status.last_result = result;
        status.error = null;
        await updatePeerLastSeen(node_id);
        await loadKnownPeers();
        syncStatuses.value.set(node_id, { ...status });
        // Notify components so they can reload vault data
        window.dispatchEvent(new CustomEvent('vaulty:sync-complete', { detail: result }));
      } catch (e: any) {
        status.error = e?.toString() ?? 'Merge failed';
        syncStatuses.value.set(node_id, { ...status });
      }
    });
  }

  const isConnectedToAnyPeer = computed(() => connectedPeers.value.length > 0);

  function getPeerStatus(nodeId: string): SyncStatus | null {
    return syncStatuses.value.get(nodeId) ?? null;
  }

  return {
    // file-based sync
    isSyncing: computed(() => isSyncing.value),
    lastSyncTime: computed(() => lastSyncTime.value),
    formattedLastSync,
    syncError: computed(() => syncError.value),
    initialize,
    exportToFile,
    importFromFile,
    // P2P peers
    connectedPeers: computed(() => connectedPeers.value),
    knownPeers: computed(() => knownPeers.value),
    nodeTicket: computed(() => nodeTicket.value),
    isLoadingTicket: computed(() => isLoadingTicket.value),
    isConnecting: computed(() => isConnecting.value),
    peerError: computed(() => peerError.value),
    isConnectedToAnyPeer,
    loadNodeTicket,
    dialPeer,
    disconnectPeer,
    refreshConnectedPeers,
    // P2P sync
    isSyncingPeer: computed(() => isSyncingPeer.value),
    syncStatuses: computed(() => syncStatuses.value),
    setVaultPublicKey,
    syncWithPeer,
    syncAllPeers,
    getPeerStatus,
    updatePeerLastSeen,
    reconnectKnownPeers,
    startBackgroundSync,
    stopBackgroundSync,
    // P2P endpoint & device management
    endpointReady: computed(() => endpointReady.value),
    endpointChecked: computed(() => endpointChecked.value),
    revokeDevice,
    renamePeer,
    loadEndpointStatus,
    loadRevokedPeersIntoRust,
  };
});
