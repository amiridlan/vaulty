<template>
  <div
    v-if="updaterStore.updateAvailable && !updaterStore.dismissed"
    class="w-full border-b border-blue-500/30 bg-blue-500/10 px-4 py-2.5"
  >
    <!-- Update available -->
    <div v-if="!updaterStore.isDownloading && !updaterStore.isReady" class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <ArrowUpCircle :size="16" class="text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <div class="min-w-0">
          <span class="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Vaulty {{ updaterStore.updateVersion }} is available
          </span>
          <button
            v-if="updaterStore.releaseNotes"
            @click="showNotes = !showNotes"
            class="ml-2 text-xs text-blue-700 dark:text-blue-300 hover:underline"
          >
            {{ showNotes ? 'hide notes' : 'what\'s new' }}
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3 flex-shrink-0">
        <button
          @click="updaterStore.downloadAndInstall()"
          class="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Download :size="12" />
          Update Now
        </button>
        <button
          @click="updaterStore.dismiss()"
          class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          title="Dismiss"
        >
          <X :size="16" />
        </button>
      </div>
    </div>

    <!-- Downloading -->
    <div v-else-if="updaterStore.isDownloading" class="flex items-center gap-4">
      <Download :size="16" class="text-blue-600 dark:text-blue-400 flex-shrink-0 animate-pulse" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-blue-900 dark:text-blue-100">Downloading update…</span>
          <span class="text-xs text-blue-700 dark:text-blue-300">
            {{ updaterStore.totalBytes > 0 ? `${updaterStore.downloadProgress}%` : 'calculating…' }}
          </span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
          <div
            class="h-full rounded-full bg-blue-600 transition-all duration-300"
            :class="updaterStore.totalBytes === 0 ? 'animate-pulse w-1/3' : ''"
            :style="updaterStore.totalBytes > 0 ? { width: `${updaterStore.downloadProgress}%` } : {}"
          />
        </div>
      </div>
    </div>

    <!-- Ready to restart -->
    <div v-else-if="updaterStore.isReady" class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <CheckCircle :size="16" class="text-green-600 dark:text-green-400 flex-shrink-0" />
        <span class="text-sm font-semibold text-green-900 dark:text-green-100">
          Update ready — restart to apply Vaulty {{ updaterStore.updateVersion }}
        </span>
      </div>
      <button
        @click="updaterStore.restartApp()"
        class="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors flex-shrink-0"
      >
        <RotateCcw :size="12" />
        Restart Now
      </button>
    </div>

    <!-- Error -->
    <div v-if="updaterStore.error" class="mt-1.5 text-xs text-destructive">
      {{ updaterStore.error }}
    </div>

    <!-- Release notes (collapsible) -->
    <div v-if="showNotes && updaterStore.releaseNotes" class="mt-2 pt-2 border-t border-blue-500/20">
      <p class="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-line">{{ updaterStore.releaseNotes }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUpdaterStore } from '../stores/updater';
import { ArrowUpCircle, Download, X, CheckCircle, RotateCcw } from 'lucide-vue-next';

const updaterStore = useUpdaterStore();
const showNotes = ref(false);
</script>
