<template>
  <div class="min-h-screen bg-primary flex items-center justify-center p-4">
    <div class="bg-card rounded-lg shadow-2xl p-8 w-full max-w-md border border-border">

      <!-- Step 1: Choice screen -->
      <template v-if="step === 'choice'">
        <div class="text-center mb-8">
          <div class="inline-block p-3 bg-primary/10 rounded-full mb-4">
            <svg class="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 class="text-3xl font-bold text-card-foreground mb-2">Welcome to Vaulty</h1>
          <p class="text-muted-foreground text-sm">Your passwords, stored locally and synced privately.</p>
        </div>

        <div class="space-y-4">
          <button
            @click="emit('new-vault')"
            class="w-full flex items-center gap-4 rounded-lg border-2 border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 p-5 text-left transition-all duration-200"
          >
            <div class="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
              <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <div>
              <p class="font-semibold text-card-foreground">New Vault</p>
              <p class="text-sm text-muted-foreground mt-0.5">Create a fresh vault on this device</p>
            </div>
          </button>

          <button
            @click="step = 'join'"
            class="w-full flex items-center gap-4 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-muted/50 p-5 text-left transition-all duration-200"
          >
            <div class="flex-shrink-0 p-2 bg-muted rounded-lg">
              <svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p class="font-semibold text-card-foreground">Join Existing Vault</p>
              <p class="text-sm text-muted-foreground mt-0.5">Sync from a vault you already have on another device</p>
            </div>
          </button>
        </div>
      </template>

      <!-- Step 2: Join existing vault form -->
      <template v-if="step === 'join'">
        <div class="mb-6">
          <button
            type="button"
            @click="step = 'choice'"
            class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 class="text-2xl font-bold text-card-foreground mb-1">Join Existing Vault</h2>
          <p class="text-sm text-muted-foreground">
            Enter the sync code from your original device and use the same master password.
          </p>
        </div>

        <form @submit.prevent="handleJoin" class="space-y-5">
          <!-- Sync Code -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-card-foreground">Sync Code</label>
            <input
              v-model="syncCode"
              type="text"
              required
              spellcheck="false"
              autocomplete="off"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Paste sync code from your other device"
              @input="syncCodeError = ''"
            />
            <p v-if="syncCodeError" class="text-xs text-destructive">{{ syncCodeError }}</p>
          </div>

          <!-- Master Password -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-card-foreground">Master Password</label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pr-10"
                placeholder="Same password as on your original device"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <svg v-if="!showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-card-foreground">Confirm Password</label>
            <input
              v-model="confirmPassword"
              type="password"
              required
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Re-enter your master password"
            />
          </div>

          <div v-if="error" class="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p class="text-sm text-destructive">{{ error }}</p>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="inline-flex items-center justify-center w-full rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-secondary h-10 px-4 py-2"
          >
            {{ loading ? 'Setting up...' : 'Join Vault' }}
          </button>
        </form>

        <div class="mt-5 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <p class="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> Your vault data will appear after you connect to your original device
            on the same network. Make sure both devices are running Vaulty.
          </p>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { VaultIdentityService } from '../services/vaultIdentity';

const emit = defineEmits<{
  'new-vault': [];
  'joined': [];
}>();

const authStore = useAuthStore();

const step = ref<'choice' | 'join'>('choice');

const syncCode = ref('');
const syncCodeError = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const error = ref('');
const loading = ref(false);

async function handleJoin() {
  error.value = '';
  syncCodeError.value = '';

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match';
    return;
  }

  if (password.value.length < 12) {
    error.value = 'Password must be at least 12 characters';
    return;
  }

  const isValid = await VaultIdentityService.validateSyncCode(syncCode.value.trim());
  if (!isValid) {
    syncCodeError.value = 'Invalid sync code — check that you copied it correctly';
    return;
  }

  loading.value = true;
  try {
    await authStore.createMasterPassword(password.value);
    await VaultIdentityService.storePendingJoin(syncCode.value.trim());
    emit('joined');
  } catch (err: any) {
    error.value = err.message || 'Failed to set up vault';
  } finally {
    loading.value = false;
  }
}
</script>
