import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { SyncService } from '../services/sync';
// import type { SyncData } from '../services/sync';

export const useSyncStore = defineStore('sync', () => {
  const isSyncing = ref(false);
  const lastSyncTime = ref<Date | null>(null);
  const syncError = ref('');

  // Initialize sync metadata
  async function initialize() {
    await SyncService.initializeSyncMetadata();
    await loadLastSyncTime();
  }

  // Load last sync time
  async function loadLastSyncTime() {
    lastSyncTime.value = await SyncService.getLastSyncTime();
  }

  // Export data to file
  async function exportToFile(): Promise<string> {
    try {
      isSyncing.value = true;
      syncError.value = '';
      
      const filename = await SyncService.saveSyncFile();
      await loadLastSyncTime();
      
      return filename;
    } catch (error: any) {
      syncError.value = error.message || 'Failed to export data';
      throw error;
    } finally {
      isSyncing.value = false;
    }
  }

  // Import data from file
  async function importFromFile(file: File): Promise<void> {
    try {
      isSyncing.value = true;
      syncError.value = '';
      
      await SyncService.loadSyncFile(file);
      await loadLastSyncTime();
    } catch (error: any) {
      syncError.value = error.message || 'Failed to import data';
      throw error;
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

  return {
    isSyncing: computed(() => isSyncing.value),
    lastSyncTime: computed(() => lastSyncTime.value),
    formattedLastSync,
    syncError: computed(() => syncError.value),
    initialize,
    exportToFile,
    importFromFile,
  };
});