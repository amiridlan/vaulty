<template>
  <div class="bg-white rounded-lg shadow-lg p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="text-xl font-bold text-gray-800">Device Sync</h3>
        <p class="text-sm text-gray-500 mt-1">
          Sync your vault with other devices without internet
        </p>
      </div>
      <div class="flex items-center gap-2">
        <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </div>
    </div>

    <!-- Device Info -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-blue-900">This Device</p>
          <p class="text-xs text-blue-700 font-mono mt-1">{{ deviceId }}</p>
        </div>
      </div>
    </div>

    <!-- Last Sync Info -->
    <div class="bg-gray-50 rounded-lg p-4 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-700">Last Sync</p>
          <p class="text-lg font-semibold text-gray-900 mt-1">{{ syncStore.formattedLastSync }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-500">Device ID</p>
          <p class="text-xs text-gray-700 font-mono mt-1">{{ deviceId.slice(0, 12) }}...</p>
        </div>
      </div>
    </div>

    <!-- Sync Actions -->
    <div class="space-y-4">
      <!-- Export Data -->
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 transition duration-200">
        <div class="text-center">
          <svg class="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h4 class="text-lg font-semibold text-gray-800 mb-2">Export Vault Data</h4>
          <p class="text-sm text-gray-600 mb-4">
            Download an encrypted file to sync with another device
          </p>
          <button
            @click="handleExport"
            :disabled="syncStore.isSyncing"
            class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="syncStore.isSyncing">Exporting...</span>
            <span v-else>Export Data</span>
          </button>
        </div>
      </div>

      <!-- Import Data -->
  <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-green-500 transition duration-200">
    <div class="text-center">
      <svg class="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
      <h4 class="text-lg font-semibold text-gray-800 mb-2">Import Vault Data</h4>
      <p class="text-sm text-gray-600 mb-4">
        Upload a sync file from another device to merge data
      </p>
      
      <!-- Desktop: Direct file picker -->
      <button
        v-if="isDesktop"
        @click="handleImportDesktop"
        :disabled="syncStore.isSyncing"
        class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="syncStore.isSyncing">Importing...</span>
        <span v-else>Choose File to Import</span>
      </button>

      <!-- Browser: File input -->
      <template v-else>
        <input
          ref="fileInput"
          type="file"
          accept=".pvs"
          @change="handleFileSelect"
          class="hidden"
        />
        
        <button
          @click="triggerFileInput"
          :disabled="syncStore.isSyncing"
          class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="syncStore.isSyncing">Importing...</span>
          <span v-else>Select File to Import</span>
        </button>
      </template>
    </div>
  </div>
    </div>

    <!-- Success Message -->
    <div
      v-if="successMessage"
      class="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm"
    >
      {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div
      v-if="syncStore.syncError"
      class="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
    >
      {{ syncStore.syncError }}
    </div>

    <!-- Info Box -->
    <div class="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div class="flex gap-3">
        <svg class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="text-sm text-yellow-800">
          <p class="font-semibold mb-1">How it works:</p>
          <ul class="list-disc list-inside space-y-1">
            <li>Export creates an encrypted .pvs file</li>
            <li>Transfer the file via USB, local network share, or any method</li>
            <li>Import on another device to merge data</li>
            <li>Newer data always overwrites older data</li>
            <li>No internet connection required</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSyncStore } from '../stores/sync';
import { usePasswordOwnersStore } from '../stores/passwordOwners';
import { SyncService } from '../services/sync';
import { isDesktopApp } from '../utils/tauri';

const syncStore = useSyncStore();
const passwordStore = usePasswordOwnersStore();

const fileInput = ref<HTMLInputElement | null>(null);
const successMessage = ref('');
const deviceId = ref('');
const isDesktop = computed(() => isDesktopApp());

onMounted(async () => {
  await syncStore.initialize();
  deviceId.value = SyncService.getDeviceId();
});

async function handleExport() {
  try {
    successMessage.value = '';
    const result = await syncStore.exportToFile();
    
    if (isDesktopApp()) {
      successMessage.value = `Successfully exported data to:\n${result}`;
    } else {
      successMessage.value = `Successfully exported data to ${result}`;
    }
    
    setTimeout(() => {
      successMessage.value = '';
    }, 5000);
  } catch (error: any) {
    console.error('Export error:', error);
  }
}

// Desktop: Direct file picker
async function handleImportDesktop() {
  try {
    successMessage.value = '';
    await SyncService.loadSyncFile();
    
    // Reload password owners and entries
    await passwordStore.loadOwners();
    if (passwordStore.currentOwnerId) {
      await passwordStore.loadPasswordEntries(passwordStore.currentOwnerId);
    }
    
    successMessage.value = 'Successfully imported and merged data!';
    
    setTimeout(() => {
      successMessage.value = '';
    }, 5000);
  } catch (error: any) {
    console.error('Import error:', error);
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

// Browser: File input
async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;

  try {
    successMessage.value = '';
    await syncStore.importFromFile(file);
    
    // Reload password owners and entries
    await passwordStore.loadOwners();
    if (passwordStore.currentOwnerId) {
      await passwordStore.loadPasswordEntries(passwordStore.currentOwnerId);
    }
    
    successMessage.value = 'Successfully imported and merged data!';
    
    setTimeout(() => {
      successMessage.value = '';
    }, 5000);
  } catch (error: any) {
    console.error('Import error:', error);
  }
  
  // Reset file input
  target.value = '';
}
</script>