<template>
  <div class="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all duration-200">
    <div class="flex justify-between items-start mb-3">
      <div class="flex-1">
        <h4 class="text-lg font-semibold text-foreground mb-1">{{ entry.site }}</h4>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground font-medium">Username:</span>
            <span v-if="!showDetails" class="text-sm text-foreground">••••••••</span>
            <span v-else class="text-sm text-foreground">{{ entry.username }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground font-medium">Email:</span>
            <span v-if="!showDetails" class="text-sm text-foreground">••••••••</span>
            <span v-else class="text-sm text-foreground">{{ entry.email }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground font-medium">Password:</span>
            <span v-if="!showDetails" class="text-sm text-foreground">••••••••</span>
            <span v-else class="text-sm text-foreground font-mono">{{ entry.password }}</span>
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          @click="toggleDetails"
          :title="showDetails ? 'Hide' : 'Show'"
          class="bg-primary hover:bg-muted hover:text-foreground"
        >
          <Eye v-if="!showDetails" :size="18" :stroke-width="2.5" />
          <EyeOff v-else :size="18" :stroke-width="2.5" />
        </button>

        <button
          @click="$emit('edit', entry)"
          title="Edit"
          class="bg-primary hover:bg-muted hover:text-foreground"
        >
          <Pencil :size="18" :stroke-width="2.5" />
        </button>

        <button
          @click="handleCopyPassword"
          title="Copy Password"
          class="bg-primary hover:bg-muted hover:text-foreground"
        >
          <Copy :size="18" :stroke-width="2.5" />
        </button>

        <button
          @click="$emit('delete', entry.id)"
          title="Delete"
          class="bg-primary hover:bg-muted hover:text-foreground"
        >
          <Trash2 :size="18" :stroke-width="2.5" />
        </button>
      </div>
    </div>

    <div class="text-xs text-muted-foreground mt-2">
      Updated: {{ formatDate(entry.updated_at) }}
    </div>

    <!-- Copy notification -->
    <div
      v-if="showCopyNotification"
      class="mt-2 rounded-md border border-green-500/50 bg-green-500/10 px-3 py-1"
    >
      <p class="text-sm text-green-700 dark:text-green-400">Password copied to clipboard!</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { DecryptedPasswordEntry } from '../types';
import { SecurityUtils } from '../utils/security';
import { Eye, EyeOff, Pencil, Copy, Trash2 } from 'lucide-vue-next';


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