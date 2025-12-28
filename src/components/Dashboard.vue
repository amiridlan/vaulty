<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="w-full px-4 sm:px-6 lg:px-8">
        <div class="flex flex-wrap sm:flex-nowrap justify-between items-center py-4 gap-4">
          <div class="flex items-center">
            <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Password Vault</h1>
            <span class="ml-2 sm:ml-4 px-2 sm:px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
              Encrypted
            </span>
          </div>

          <div class="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
            <!-- Activity Timer -->
            <div class="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
              Logout: <span class="font-semibold">{{ formattedTimeRemaining }}</span>
            </div>

            <!-- Sync Button -->
            <button
              @click="showSyncModal = true"
              class="flex items-center gap-2 px-3 sm:px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition duration-200"
              title="Sync with other devices"
            >
              <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span class="text-sm sm:text-base">Sync</span>
            </button>

            <!-- Back to Owners Button (when viewing passwords) -->
            <button
              v-if="viewState === 'passwords'"
              @click="backToOwners"
              class="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 hover:text-gray-900 transition duration-200 whitespace-nowrap"
            >
              ← Back
            </button>

            <!-- Logout Button -->
            <button
              @click="confirmLogout"
              class="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-lg transition duration-200 text-sm sm:text-base"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
    <footer class="bg-white border-t border-gray-200 mt-12">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-4">
        <p class="text-center text-xs sm:text-sm text-gray-500">
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
    <div v-if="showSyncModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center">
          <h2 class="text-xl sm:text-2xl font-bold text-gray-800">Sync Your Vault</h2>
          <button
            @click="showSyncModal = false"
            class="text-gray-500 hover:text-gray-700 transition duration-200"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
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

// FIXED: Show modal instead of confirm
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