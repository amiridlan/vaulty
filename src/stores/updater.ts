import { defineStore } from 'pinia';
import { ref } from 'vue';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { isDesktopApp } from '../utils/tauri';

export const useUpdaterStore = defineStore('updater', () => {
  const updateAvailable = ref(false);
  const updateVersion = ref('');
  const releaseNotes = ref('');
  const downloadedBytes = ref(0);
  const totalBytes = ref(0);
  const downloadProgress = ref(0);
  const isDownloading = ref(false);
  const isReady = ref(false);
  const dismissed = ref(false);
  const error = ref('');

  let pendingUpdate: Update | null = null;

  async function checkForUpdate(): Promise<void> {
    if (!isDesktopApp()) return;
    error.value = '';
    try {
      const update = await check();
      if (!update) return;
      pendingUpdate = update;
      updateVersion.value = update.version;
      releaseNotes.value = update.body ?? '';
      updateAvailable.value = true;
    } catch {
      // Non-fatal: user may be offline or endpoint not yet configured.
    }
  }

  async function downloadAndInstall(): Promise<void> {
    if (!pendingUpdate) return;
    isDownloading.value = true;
    downloadedBytes.value = 0;
    totalBytes.value = 0;
    downloadProgress.value = 0;
    error.value = '';

    try {
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytes.value = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloadedBytes.value += event.data.chunkLength;
          if (totalBytes.value > 0) {
            downloadProgress.value = Math.round((downloadedBytes.value / totalBytes.value) * 100);
          }
        } else if (event.event === 'Finished') {
          downloadProgress.value = 100;
        }
      });
      isDownloading.value = false;
      isReady.value = true;
    } catch (e: any) {
      error.value = e?.toString() ?? 'Update failed';
      isDownloading.value = false;
    }
  }

  async function restartApp(): Promise<void> {
    await relaunch();
  }

  function dismiss(): void {
    dismissed.value = true;
  }

  return {
    updateAvailable,
    updateVersion,
    releaseNotes,
    downloadedBytes,
    totalBytes,
    downloadProgress,
    isDownloading,
    isReady,
    dismissed,
    error,
    checkForUpdate,
    downloadAndInstall,
    restartApp,
    dismiss,
  };
});
