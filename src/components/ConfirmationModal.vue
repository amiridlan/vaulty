<template>
  <div 
    v-if="show"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
    @click.self="handleCancel"
  >
    <div class="bg-card rounded-lg shadow-2xl p-6 w-full max-w-md mx-4 border border-border">
      <div class="flex items-start gap-4 mb-4">
        <div class="flex-shrink-0">
          <svg 
            class="w-6 h-6"
            :class="icon === 'danger' ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-500'"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-foreground mb-2">
            {{ title }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ message }}
          </p>
        </div>
      </div>

      <div class="flex gap-3 justify-end mt-6">
        <button
          @click="handleCancel"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          {{ cancelText }}
        </button>
        <button
          @click="handleConfirm"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2"
          :class="icon === 'danger' 
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
            : 'bg-primary text-primary-foreground hover:bg-primary/90'"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';

const props = defineProps<{
  show: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: 'danger' | 'warning';
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function handleConfirm() {
  emit('confirm');
}

function handleCancel() {
  emit('cancel');
}

// Prevent body scroll when modal is open
watch(() => props.show, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});
</script>