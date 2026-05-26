<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { useSyncStore } from './stores/sync';
import { useUpdaterStore } from './stores/updater';
import { initDatabase } from './services/database';
import { VaultIdentityService } from './services/vaultIdentity';
import { isDesktopApp, waitForTauri } from './utils/tauri';
import FirstLaunch from './components/FirstLaunch.vue';
import Login from './components/Login.vue';
import Dashboard from './components/Dashboard.vue';
import SyncCode from './components/SyncCode.vue';
import UpdateBanner from './components/UpdateBanner.vue';

type AppView = 'loading' | 'error' | 'first-launch' | 'login' | 'show-sync-code' | 'dashboard';

const authStore = useAuthStore();
const syncStore = useSyncStore();
const updaterStore = useUpdaterStore();

const appView = ref<AppView>('loading');
const errorMsg = ref('');
const errorDetails = ref('');
const environment = ref('');
const pendingSyncCode = ref('');

async function initialize() {
  appView.value = 'loading';
  errorMsg.value = '';

  try {
    if (isDesktopApp()) {
      environment.value = 'Desktop';
      const tauriReady = await waitForTauri(10000);
      if (!tauriReady) throw new Error('Tauri API not available.');
    } else {
      environment.value = 'Web';
    }

    await initDatabase();

    // Determine which screen to show
    const hasPassword = await authStore.hasMasterPassword();
    const hasVaultIdentity = await VaultIdentityService.hasVaultIdentity();

    if (!hasPassword && !hasVaultIdentity) {
      appView.value = 'first-launch';
    } else if (hasPassword && authStore.isAuthenticated) {
      appView.value = 'dashboard';
    } else {
      appView.value = 'login';
    }
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to initialize application';
    errorDetails.value = err.stack || JSON.stringify(err, null, 2);
    appView.value = 'error';
  }
}

// Called by Login.vue after first-time vault setup completes.
// Shows the sync code screen before entering the dashboard.
function handleVaultCreated(vaultPublicKey: string) {
  pendingSyncCode.value = vaultPublicKey;
  syncStore.setVaultPublicKey(vaultPublicKey);
  appView.value = 'show-sync-code';
}

// Called by FirstLaunch.vue when the user picks "New Vault".
// Transition to the normal setup flow inside Login.vue.
function handleNewVault() {
  appView.value = 'login';
}

// Called by FirstLaunch.vue after a successful "Join Existing Vault" setup.
// User is already authenticated at this point; go straight to dashboard.
function handleJoined() {
  appView.value = 'dashboard';
  setTimeout(() => {
    syncStore.reconnectKnownPeers();
    syncStore.startBackgroundSync();
  }, 2000);
  setTimeout(() => updaterStore.checkForUpdate(), 5000);
}

// Called by Login.vue when re-authentication succeeds during normal login.
async function handleAuthenticated() {
  const identity = await VaultIdentityService.getVaultIdentity();
  if (identity) syncStore.setVaultPublicKey(identity.vault_public_key);
  appView.value = 'dashboard';
  // Reconnect to known peers now that the endpoint has had time to start up.
  // Use a small delay so the dashboard renders before reconnect attempts block.
  setTimeout(() => {
    syncStore.reconnectKnownPeers();
    syncStore.startBackgroundSync();
  }, 2000);
  setTimeout(() => updaterStore.checkForUpdate(), 5000);
}

onMounted(() => {
  setTimeout(initialize, 100);
});
</script>

<template>
  <div id="app">
    <!-- Loading -->
    <div
      v-if="appView === 'loading'"
      class="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center"
    >
      <div class="text-white text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
        <p class="text-xl">Initializing Vaulty...</p>
        <p class="text-sm mt-2 opacity-75">{{ environment }} Version</p>
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="appView === 'error'"
      class="min-h-screen bg-red-50 flex items-center justify-center p-4"
    >
      <div class="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 class="text-2xl font-bold text-red-600 mb-4">Initialization Error</h2>
        <p class="text-gray-700 mb-4">{{ errorMsg }}</p>
        <div v-if="!isDesktopApp()" class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <p class="text-sm text-blue-800">
            <strong>Note:</strong> You are running the web version. Some features require the desktop app.
          </p>
        </div>
        <pre
          v-if="errorDetails"
          class="text-xs text-gray-600 bg-gray-100 p-2 rounded mb-4 overflow-auto max-h-40"
        >{{ errorDetails }}</pre>
        <button
          @click="initialize"
          class="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition duration-200"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- First launch: New Vault / Join Existing -->
    <FirstLaunch
      v-else-if="appView === 'first-launch'"
      @new-vault="handleNewVault"
      @joined="handleJoined"
    />

    <!-- Show sync code once after new vault creation -->
    <div
      v-else-if="appView === 'show-sync-code'"
      class="min-h-screen bg-primary flex items-center justify-center p-4"
    >
      <div class="bg-card rounded-lg shadow-2xl p-8 w-full max-w-md border border-border">
        <div class="text-center mb-6">
          <div class="inline-block p-3 bg-green-500/10 rounded-full mb-4">
            <svg class="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-card-foreground mb-1">Vault Created</h2>
          <p class="text-sm text-muted-foreground">Save your sync code before continuing.</p>
        </div>

        <SyncCode :vault-public-key="pendingSyncCode" :prominent="true" class="mb-6" />

        <button
          @click="appView = 'dashboard'"
          class="inline-flex items-center justify-center w-full rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-secondary h-10 px-4 py-2 transition-colors"
        >
          I've saved my sync code — Continue
        </button>
      </div>
    </div>

    <!-- Normal login / first-time setup -->
    <Login
      v-else-if="appView === 'login'"
      @vault-created="handleVaultCreated"
      @authenticated="handleAuthenticated"
    />

    <!-- Main app -->
    <div v-else-if="appView === 'dashboard'" class="flex flex-col min-h-screen">
      <UpdateBanner />
      <Dashboard class="flex-1" />
    </div>
  </div>
</template>
