<template>
  <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition duration-200">
    <div class="flex justify-between items-start mb-3">
      <div class="flex-1">
        <h4 class="text-lg font-semibold text-gray-800 mb-1">{{ entry.site }}</h4>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500 font-medium">Username:</span>
            <span v-if="!showDetails" class="text-sm text-gray-700">••••••••</span>
            <span v-else class="text-sm text-gray-700">{{ entry.username }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500 font-medium">Email:</span>
            <span v-if="!showDetails" class="text-sm text-gray-700">••••••••</span>
            <span v-else class="text-sm text-gray-700">{{ entry.email }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500 font-medium">Password:</span>
            <span v-if="!showDetails" class="text-sm text-gray-700">••••••••</span>
            <span v-else class="text-sm text-gray-700 font-mono">{{ entry.password }}</span>
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          @click="toggleDetails"
          :title="showDetails ? 'Hide' : 'Show'"
          class="text-gray-500 hover:text-blue-600 transition duration-200"
        >
          <svg v-if="!showDetails" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        </button>
        
        <button
          @click="$emit('edit', entry)"
          title="Edit"
          class="text-gray-500 hover:text-blue-600 transition duration-200"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <button
          @click="handleCopyPassword"
          title="Copy Password"
          class="text-gray-500 hover:text-green-600 transition duration-200"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>

        <button
          @click="$emit('delete', entry.id)"
          title="Delete"
          class="text-gray-500 hover:text-red-600 transition duration-200"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <div class="text-xs text-gray-400 mt-2">
      Updated: {{ formatDate(entry.updated_at) }}
    </div>

    <!-- Copy notification -->
    <div
      v-if="showCopyNotification"
      class="mt-2 bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded text-sm"
    >
      Password copied to clipboard!
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { DecryptedPasswordEntry } from '../types';
import { SecurityUtils } from '../utils/security';


const props = defineProps<{
  entry: DecryptedPasswordEntry
}>();

defineEmits<{
  edit: [entry: DecryptedPasswordEntry]
  delete: [id: number]
}>();

const showDetails = ref(false);
const showCopyNotification = ref(false);

function toggleDetails() {
  showDetails.value = !showDetails.value;
}

async function handleCopyPassword() {
  try {
    await navigator.clipboard.writeText(props.entry.password);
    showCopyNotification.value = true;
    
    // Clear clipboard after 30 seconds for security
    SecurityUtils.clearClipboardAfter(30);
    
    setTimeout(() => {
      showCopyNotification.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy password:', err);
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}
</script>