<template>
  <div class="bg-card rounded-lg shadow-lg p-6 border border-border">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-xl font-bold text-foreground">Device Sync</h3>
        <p class="text-sm text-muted-foreground mt-1">
          Sync your vault with other devices without internet
        </p>
      </div>
      <ArrowLeftRight :size="28" :stroke-width="2.5" class="text-primary" />
    </div>

    <!-- Sync status chip -->
    <div class="flex items-center gap-3 mb-6">
      <div class="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border"
        :class="syncStore.isSyncingPeer
          ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300'
          : syncStore.isConnectedToAnyPeer
            ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300'
            : 'border-border bg-muted text-muted-foreground'"
      >
        <span v-if="syncStore.isSyncingPeer" class="animate-pulse">● Syncing…</span>
        <span v-else-if="syncStore.isConnectedToAnyPeer">● {{ syncStore.connectedPeers.length }} device{{ syncStore.connectedPeers.length !== 1 ? 's' : '' }} connected</span>
        <span v-else>○ No devices connected</span>
      </div>
      <button
        v-if="isDesktop && !syncStore.isConnectedToAnyPeer"
        @click="handleReconnect"
        :disabled="isReconnecting"
        class="text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
      >
        {{ isReconnecting ? 'Reconnecting…' : 'Reconnect' }}
      </button>
    </div>

    <!-- Vault Sync Code -->
    <div class="mb-6">
      <SyncCode v-if="vaultPublicKey" :vault-public-key="vaultPublicKey" />
      <div v-if="isPendingJoin" class="mt-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3">
        <p class="text-xs text-yellow-800 dark:text-yellow-200">
          Waiting to sync with your original device — make sure it is online and running Vaulty.
        </p>
      </div>
    </div>

    <!-- ── P2P Section (desktop only) ──────────────────────────────────────── -->
    <template v-if="isDesktop">

      <!-- Endpoint unavailable banner -->
      <div
        v-if="syncStore.endpointChecked && !syncStore.endpointReady"
        class="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 flex gap-3"
      >
        <WifiOff :size="16" class="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p class="text-xs font-semibold text-yellow-800 dark:text-yellow-200">P2P sync is unavailable</p>
          <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
            The iroh network endpoint failed to start. File-based sync is available as a fallback.
          </p>
        </div>
      </div>

      <!-- Connected Devices -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-foreground">Connected Devices</h4>
          <div class="flex items-center gap-3">
            <button
              v-if="syncStore.connectedPeers.length > 1"
              @click="handleSyncAll"
              :disabled="syncStore.isSyncingPeer"
              class="text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
            >
              {{ syncStore.isSyncingPeer ? 'Syncing…' : 'Sync All' }}
            </button>
            <button
              @click="syncStore.refreshConnectedPeers()"
              class="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        <div v-if="syncStore.connectedPeers.length === 0" class="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
          No devices connected
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="peer in syncStore.connectedPeers"
            :key="peer.node_id"
            class="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <div class="min-w-0">
                  <p class="text-xs font-medium text-foreground">
                    {{ peerLabel(peer.node_id) || 'Unknown Device' }}
                  </p>
                  <p class="text-xs text-muted-foreground font-mono truncate">
                    {{ peer.node_id.slice(0, 20) }}…
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 ml-2 flex-shrink-0">
                <button
                  @click="handleSyncNow(peer.node_id)"
                  :disabled="syncStore.isSyncingPeer"
                  class="text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                >
                  Sync Now
                </button>
                <button
                  @click="handleDisconnect(peer.node_id)"
                  class="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>

            <!-- Per-peer sync status -->
            <div v-if="syncStore.getPeerStatus(peer.node_id)" class="mt-2 pt-2 border-t border-green-500/20">
              <p v-if="syncStore.getPeerStatus(peer.node_id)?.error" class="text-xs text-destructive">
                {{ syncStore.getPeerStatus(peer.node_id)?.error }}
              </p>
              <p v-else-if="syncStore.getPeerStatus(peer.node_id)?.last_sync" class="text-xs text-muted-foreground">
                Last synced {{ formatSyncTime(syncStore.getPeerStatus(peer.node_id)?.last_sync ?? null) }}
                <template v-if="syncStore.getPeerStatus(peer.node_id)?.last_result as any">
                  —
                  {{ (syncStore.getPeerStatus(peer.node_id)?.last_result?.owners_added ?? 0) +
                     (syncStore.getPeerStatus(peer.node_id)?.last_result?.entries_added ?? 0) }} added,
                  {{ (syncStore.getPeerStatus(peer.node_id)?.last_result?.owners_updated ?? 0) +
                     (syncStore.getPeerStatus(peer.node_id)?.last_result?.entries_updated ?? 0) }} updated
                </template>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Managed Devices -->
      <div class="mb-6">
        <h4 class="text-sm font-semibold text-foreground mb-3">Managed Devices</h4>

        <div v-if="syncStore.knownPeers.length === 0" class="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
          No devices paired yet
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="peer in syncStore.knownPeers"
            :key="peer.node_id"
            class="rounded-lg border border-border bg-muted/20 px-4 py-3"
          >
            <!-- Revoke confirmation row -->
            <div v-if="revokingNodeId === peer.node_id" class="flex items-center justify-between">
              <p class="text-xs text-destructive">Revoke access for this device?</p>
              <div class="flex gap-3">
                <button @click="confirmRevoke" class="text-xs text-destructive font-medium hover:text-destructive/80 transition-colors">Revoke</button>
                <button @click="revokingNodeId = null" class="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </div>
            </div>

            <!-- Normal row -->
            <div v-else class="flex items-center justify-between">
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  :class="isConnected(peer.node_id) ? 'bg-green-500' : 'bg-muted-foreground/40'"
                />
                <div class="min-w-0">
                  <!-- Rename mode -->
                  <div v-if="renamingNodeId === peer.node_id" class="flex items-center gap-2">
                    <input
                      v-model="renamingLabel"
                      @keyup.enter="confirmRename"
                      @keyup.escape="cancelRename"
                      class="text-xs bg-background border border-border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring w-32"
                      placeholder="Device name"
                    />
                    <button @click="confirmRename" class="text-xs text-primary hover:text-primary/80 transition-colors">Save</button>
                    <button @click="cancelRename" class="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  </div>
                  <!-- Display mode -->
                  <p v-else class="text-xs font-medium text-foreground">{{ peer.label || 'Unknown Device' }}</p>
                  <p class="text-xs text-muted-foreground font-mono truncate">{{ peer.node_id.slice(0, 20) }}…</p>
                </div>
              </div>
              <div v-if="renamingNodeId !== peer.node_id" class="flex items-center gap-3 ml-2 flex-shrink-0">
                <button
                  @click="startRename(peer.node_id, peer.label ?? null)"
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Rename
                </button>
                <button
                  @click="revokingNodeId = peer.node_id"
                  class="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Revoke
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Device -->
      <div class="mb-6">
        <button
          @click="showAddDevice = !showAddDevice"
          class="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <Plus :size="16" :stroke-width="2.5" />
          {{ showAddDevice ? 'Cancel' : 'Add Device' }}
        </button>

        <div v-if="showAddDevice" class="mt-4 space-y-4">
          <!-- Step 1: Show own ticket -->
          <div class="rounded-lg border border-border bg-muted/30 p-4">
            <p class="text-xs font-semibold text-foreground mb-2">Step 1 — Share your connection ticket</p>
            <p class="text-xs text-muted-foreground mb-3">
              Copy this ticket and paste it on the other device.
            </p>
            <div v-if="syncStore.isLoadingTicket" class="text-xs text-muted-foreground">
              Getting connection ticket…
            </div>
            <div v-else-if="syncStore.nodeTicket" class="flex items-start gap-2">
              <code class="flex-1 text-xs font-mono bg-background border border-border rounded px-3 py-2 break-all">
                {{ syncStore.nodeTicket }}
              </code>
              <button
                @click="copyTicket"
                class="flex-shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                <Check v-if="ticketCopied" :size="14" class="text-green-500" />
                <Copy v-else :size="14" />
                {{ ticketCopied ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <p v-else class="text-xs text-destructive">{{ syncStore.peerError || 'Failed to load ticket' }}</p>
          </div>

          <!-- Step 2: Paste other device's ticket -->
          <div class="rounded-lg border border-border bg-muted/30 p-4">
            <p class="text-xs font-semibold text-foreground mb-2">Step 2 — Enter the other device's ticket</p>
            <p class="text-xs text-muted-foreground mb-3">
              Paste the ticket from the other device, then click Connect.
            </p>
            <textarea
              v-model="peerTicketInput"
              placeholder="Paste connection ticket here…"
              rows="3"
              class="w-full text-xs font-mono bg-background border border-border rounded px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div class="flex items-center gap-2 mt-2">
              <button
                @click="handleConnect"
                :disabled="!peerTicketInput.trim() || syncStore.isConnecting"
                class="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                <span v-if="syncStore.isConnecting">Connecting…</span>
                <span v-else>Connect</span>
              </button>
              <p v-if="syncStore.peerError" class="text-xs text-destructive">{{ syncStore.peerError }}</p>
              <p v-if="connectSuccess" class="text-xs text-green-600 dark:text-green-400">Connected!</p>
            </div>
          </div>
        </div>
      </div>

    </template>
    <!-- ── end P2P section ─────────────────────────────────────────────────── -->

    <!-- File-based Sync (legacy — collapsible) -->
    <div class="mb-4">
      <button
        @click="showLegacySync = !showLegacySync"
        class="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown :size="14" :class="showLegacySync ? 'rotate-180' : ''" class="transition-transform" />
        {{ showLegacySync ? 'Hide' : 'Show' }} file-based sync (legacy)
      </button>
    </div>

    <div v-if="showLegacySync || (isDesktop && syncStore.endpointChecked && !syncStore.endpointReady)" class="space-y-4 mb-6">
      <!-- This Device -->
      <div class="rounded-lg border border-primary/50 bg-primary/10 p-4">
        <div class="flex items-start gap-3">
          <Monitor :size="22" :stroke-width="2.5" class="text-primary mt-0.5" />
          <div class="flex-1">
            <p class="text-sm font-medium text-foreground">This Device</p>
            <p class="text-xs text-muted-foreground font-mono mt-1">{{ deviceId }}</p>
          </div>
        </div>
      </div>

      <!-- Last File Sync -->
      <div class="bg-muted rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Last File Sync</p>
            <p class="text-lg font-semibold text-foreground mt-1">{{ syncStore.formattedLastSync }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-muted-foreground">Device ID</p>
            <p class="text-xs text-foreground font-mono mt-1">{{ deviceId.slice(0, 12) }}…</p>
          </div>
        </div>
      </div>
      <div class="border-2 border-dashed border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-200">
        <div class="text-center">
          <CloudUpload :size="56" :stroke-width="2" class="text-foreground/60 mx-auto mb-3" />
          <h4 class="text-lg font-semibold text-foreground mb-2">Export Vault Data</h4>
          <p class="text-sm text-muted-foreground mb-4">
            Download an encrypted file to sync with another device
          </p>
          <button
            @click="handleExport"
            :disabled="syncStore.isSyncing"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2"
          >
            <span v-if="syncStore.isSyncing">Exporting…</span>
            <span v-else>Export Data</span>
          </button>
        </div>
      </div>

      <div class="border-2 border-dashed border-border rounded-lg p-6 hover:border-green-500/50 transition-all duration-200">
        <div class="text-center">
          <CloudDownload :size="56" :stroke-width="2" class="text-foreground/60 mx-auto mb-3" />
          <h4 class="text-lg font-semibold text-foreground mb-2">Import Vault Data</h4>
          <p class="text-sm text-muted-foreground mb-4">
            Upload a sync file from another device to merge data
          </p>

          <button
            v-if="isDesktop"
            @click="handleImportDesktop"
            :disabled="syncStore.isSyncing"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-10 px-6 py-2"
          >
            <span v-if="syncStore.isSyncing">Importing…</span>
            <span v-else>Choose File to Import</span>
          </button>

          <template v-else>
            <input ref="fileInput" type="file" accept=".pvs" @change="handleFileSelect" class="hidden" />
            <button
              @click="triggerFileInput"
              :disabled="syncStore.isSyncing"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-10 px-6 py-2"
            >
              <span v-if="syncStore.isSyncing">Importing…</span>
              <span v-else>Select File to Import</span>
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Success / Error messages -->
    <div v-if="successMessage" class="mt-4 rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3">
      <p class="text-sm text-green-700 dark:text-green-400">{{ successMessage }}</p>
    </div>
    <div v-if="syncStore.syncError" class="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
      <p class="text-sm text-destructive">{{ syncStore.syncError }}</p>
    </div>

    <!-- How it works -->
    <div class="mt-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
      <div class="flex gap-3">
        <Info :size="20" :stroke-width="2.5" class="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
        <div class="text-sm text-yellow-800 dark:text-yellow-200">
          <p class="font-semibold mb-1">How it works:</p>
          <ul class="list-disc list-inside space-y-1">
            <li>P2P sync works directly device-to-device — no internet required</li>
            <li>Exchange connection tickets once to pair two devices</li>
            <li>Data syncs automatically when a paired device connects</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSyncStore } from '../stores/sync';
import { usePasswordOwnersStore } from '../stores/passwordOwners';
import { SyncService } from '../services/sync';
import { VaultIdentityService } from '../services/vaultIdentity';
import { isDesktopApp } from '../utils/tauri';
import { ArrowLeftRight, Monitor, CloudUpload, CloudDownload, Info, Plus, Copy, Check, ChevronDown, WifiOff } from 'lucide-vue-next';
import SyncCode from './SyncCode.vue';

const syncStore = useSyncStore();
const passwordStore = usePasswordOwnersStore();

const fileInput = ref<HTMLInputElement | null>(null);
const successMessage = ref('');
const deviceId = ref('');
const vaultPublicKey = ref('');
const isPendingJoin = ref(false);
const isDesktop = computed(() => isDesktopApp());

// P2P UI state
const showAddDevice = ref(false);
const showLegacySync = ref(false);
const peerTicketInput = ref('');
const ticketCopied = ref(false);
const connectSuccess = ref(false);
const isReconnecting = ref(false);

// Managed devices state
const renamingNodeId = ref<string | null>(null);
const renamingLabel = ref('');
const revokingNodeId = ref<string | null>(null);

function isConnected(nodeId: string): boolean {
  return syncStore.connectedPeers.some((p) => p.node_id === nodeId);
}

function startRename(nodeId: string, currentLabel: string | null) {
  renamingNodeId.value = nodeId;
  renamingLabel.value = currentLabel ?? '';
}

async function confirmRename() {
  if (!renamingNodeId.value) return;
  await syncStore.renamePeer(renamingNodeId.value, renamingLabel.value.trim());
  renamingNodeId.value = null;
  renamingLabel.value = '';
}

function cancelRename() {
  renamingNodeId.value = null;
  renamingLabel.value = '';
}

async function confirmRevoke() {
  if (!revokingNodeId.value) return;
  await syncStore.revokeDevice(revokingNodeId.value);
  revokingNodeId.value = null;
}

// Reload vault data after a sync completes
function onSyncComplete() {
  passwordStore.loadOwners().then(() => {
    if (passwordStore.currentOwnerId) {
      passwordStore.loadPasswordEntries(passwordStore.currentOwnerId);
    }
  });
  successMessage.value = 'Vault data synced!';
  setTimeout(() => (successMessage.value = ''), 4000);
}

onMounted(async () => {
  await syncStore.initialize();
  deviceId.value = SyncService.getDeviceId();

  const identity = await VaultIdentityService.getVaultIdentity();
  if (identity) {
    vaultPublicKey.value = identity.vault_public_key;
    isPendingJoin.value = VaultIdentityService.isPendingJoin(identity);
  }

  if (isDesktopApp()) {
    await syncStore.refreshConnectedPeers();
    await syncStore.loadNodeTicket();
  }

  window.addEventListener('vaulty:sync-complete', onSyncComplete);
});

onUnmounted(() => {
  window.removeEventListener('vaulty:sync-complete', onSyncComplete);
});

function peerLabel(nodeId: string): string | null {
  const known = syncStore.knownPeers.find((p) => p.node_id === nodeId);
  return known?.label ?? null;
}

function formatSyncTime(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function copyTicket() {
  if (!syncStore.nodeTicket) return;
  await navigator.clipboard.writeText(syncStore.nodeTicket);
  ticketCopied.value = true;
  setTimeout(() => (ticketCopied.value = false), 2000);
}

async function handleConnect() {
  connectSuccess.value = false;
  const peer = await syncStore.dialPeer(peerTicketInput.value.trim());
  if (peer) {
    connectSuccess.value = true;
    peerTicketInput.value = '';
    setTimeout(() => {
      connectSuccess.value = false;
      showAddDevice.value = false;
    }, 2000);
  }
}

async function handleDisconnect(nodeId: string) {
  await syncStore.disconnectPeer(nodeId);
}

async function handleReconnect() {
  isReconnecting.value = true;
  await syncStore.reconnectKnownPeers();
  await syncStore.refreshConnectedPeers();
  isReconnecting.value = false;
}

async function handleSyncNow(nodeId: string) {
  await syncStore.syncWithPeer(nodeId);
}

async function handleSyncAll() {
  await syncStore.syncAllPeers();
}

// ── File-based sync handlers ──────────────────────────────────────────────

async function handleExport() {
  try {
    successMessage.value = '';
    const result = await syncStore.exportToFile();
    successMessage.value = isDesktopApp()
      ? `Successfully exported data to:\n${result}`
      : `Successfully exported data to ${result}`;
    setTimeout(() => (successMessage.value = ''), 5000);
  } catch {
    // syncStore.syncError already set
  }
}

async function handleImportDesktop() {
  try {
    successMessage.value = '';
    await SyncService.loadSyncFile();
    await passwordStore.loadOwners();
    if (passwordStore.currentOwnerId) {
      await passwordStore.loadPasswordEntries(passwordStore.currentOwnerId);
    }
    successMessage.value = 'Successfully imported and merged data!';
    setTimeout(() => (successMessage.value = ''), 5000);
  } catch {
    // errors shown via syncStore.syncError
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  try {
    successMessage.value = '';
    await syncStore.importFromFile(file);
    await passwordStore.loadOwners();
    if (passwordStore.currentOwnerId) {
      await passwordStore.loadPasswordEntries(passwordStore.currentOwnerId);
    }
    successMessage.value = 'Successfully imported and merged data!';
    setTimeout(() => (successMessage.value = ''), 5000);
  } catch {
    // errors shown via syncStore.syncError
  }
  target.value = '';
}
</script>
