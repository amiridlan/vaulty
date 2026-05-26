<template>
  <div
    class="rounded-lg border p-4"
    :class="prominent ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted'"
  >
    <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
      Your Sync Code
    </p>

    <div class="flex items-center gap-2">
      <code
        class="flex-1 font-mono text-xs text-foreground break-all bg-background rounded px-3 py-2 border border-border select-all"
      >
        {{ vaultPublicKey }}
      </code>
      <button
        type="button"
        @click="copy"
        :title="copied ? 'Copied!' : 'Copy sync code'"
        class="flex-shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-background border border-border transition-colors"
      >
        <svg v-if="copied" class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </button>
    </div>

    <p v-if="prominent" class="text-xs text-muted-foreground mt-3 leading-relaxed">
      Share this code with your other devices to pair them with this vault.
      Save it somewhere safe — you will need it every time you add a new device.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  vaultPublicKey: string;
  prominent?: boolean;
}>();

const copied = ref(false);

async function copy() {
  await navigator.clipboard.writeText(props.vaultPublicKey);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>
