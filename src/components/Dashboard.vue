<template>
  <div class="min-h-screen bg-background flex flex-col">
    <!-- Header -->
    <header class="bg-card shadow-sm border-b border-border">
      <div class="w-full px-4 sm:px-6 lg:px-8">
        <div class="flex flex-wrap sm:flex-nowrap justify-between items-center py-4 gap-4">
          <div class="flex items-center">
            <h1 class="text-xl sm:text-2xl font-bold text-foreground">Password Vault</h1>
            <span class="ml-2 sm:ml-4 px-2 sm:px-3 py-1 bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full border border-green-500/20">
              Encrypted
            </span>
          </div>

          <div class="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
            <!-- Activity Timer -->
            <div class="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              Logout: <span class="font-semibold text-foreground">{{ formattedTimeRemaining }}</span>
            </div>

            <!-- Sync Button -->
            <button
              @click="showSyncModal = true"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-primary h-10 px-3 sm:px-4 py-2 gap-2"
              title="Sync with other devices"
            >
              <ArrowLeftRight :size="18" :stroke-width="2.5" class="sm:w-5 sm:h-5" />
              <span class="text-sm sm:text-base font-bold">Sync</span>
            </button>

            <!-- Back to Owners Button (when viewing passwords) -->
            <button
              v-if="viewState === 'passwords'"
              @click="backToOwners"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-3 sm:px-4 py-2"
            >
              ← Back
            </button>

            <!-- Logout Button -->
            <button
              @click="confirmLogout"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-3 sm:px-4 py-2"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div class="max-w-7xl mx-auto">
        <!-- Show Password Owners -->
        <PasswordOwners
          v-if="viewState === 'owners'"
          @owner-selected="handleOwnerSelected"
        />

        <!-- Show Password List for Selected Owner -->
        <PasswordList
          v-if="viewState === 'passwords'"
        />
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-card border-t border-border mt-auto">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-4">
        <p class="text-center text-xs sm:text-sm text-muted-foreground">
          🔒 All data is encrypted locally. No internet connection required.
        </p>
      </div>
    </footer>

    <!-- Logout Confirmation Modal -->
    <ConfirmationModal
      :show="showLogoutConfirm"
      title="Logout Confirmation"
      message="Are you sure you want to logout? Make sure you've saved all your changes."
      confirm-text="Logout"
      cancel-text="Stay"
      icon="warning"
      @confirm="handleLogoutConfirmed"
      @cancel="handleLogoutCancelled"
    />

    <!-- Sync Modal -->
    <div v-if="showSyncModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-card rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border shadow-lg">
        <div class="sticky top-0 bg-card border-b border-border px-4 sm:px-6 py-4 flex justify-between items-center">
          <h2 class="text-xl sm:text-2xl font-bold text-foreground">Sync Your Vault</h2>
          <button
            @click="showSyncModal = false"
            class="bg-primary hover:bg-muted"
          >
            <X :size="20" :stroke-width="2.5" />
          </button>
        </div>
        
        <div class="p-4 sm:p-6">
          <SyncPanel />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePasswordOwnersStore } from '../stores/passwordOwners';
import PasswordOwners from './PasswordOwners.vue';
import PasswordList from './PasswordList.vue';
import SyncPanel from './SyncPanel.vue';
import ConfirmationModal from './ConfirmationModal.vue';
import { ArrowLeftRight, X } from 'lucide-vue-next';

const authStore = useAuthStore();
const passwordStore = usePasswordOwnersStore();

const viewState = ref<'owners' | 'passwords'>('owners');
const timeRemaining = ref(180); // 3 minutes in seconds
const timerInterval = ref<number | null>(null);
const showSyncModal = ref(false);
const showLogoutConfirm = ref(false);

const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes

const formattedTimeRemaining = computed(() => {
  const minutes = Math.floor(timeRemaining.value / 60);
  const seconds = timeRemaining.value % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

onMounted(() => {
  startTimer();
});

onUnmounted(() => {
  stopTimer();
});

function startTimer() {
  stopTimer();
  
  timerInterval.value = window.setInterval(() => {
    const now = Date.now();
    const lastActivity = authStore.lastActivityTime || now;
    const elapsed = now - lastActivity;
    const remaining = Math.max(0, Math.floor((INACTIVITY_TIMEOUT - elapsed) / 1000));
    
    timeRemaining.value = remaining;
    
    if (remaining === 0) {
      // Auto logout without confirmation
      authStore.logout();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval.value !== null) {
    clearInterval(timerInterval.value);
    timerInterval.value = null;
  }
}

function handleOwnerSelected(_ownerId: number) {
  viewState.value = 'passwords';
}

function backToOwners() {
  viewState.value = 'owners';
  passwordStore.currentOwnerId = null;
}

function confirmLogout() {
  showLogoutConfirm.value = true;
}

function handleLogoutConfirmed() {
  showLogoutConfirm.value = false;
  authStore.logout();
}

function handleLogoutCancelled() {
  showLogoutConfirm.value = false;
}

</script>