<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
    <div class="bg-card rounded-lg shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto border border-border">
      <div class="text-center mb-8">
        <div class="inline-block p-3 bg-primary/10 rounded-full mb-4">
          <svg class="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-card-foreground mb-2">Password Vault</h1>
        <p class="text-muted-foreground">{{ isSetup ? 'Create Master Password' : 'Enter Master Password' }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Master Password -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-card-foreground">
            Master Password
          </label>
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              @input="onPasswordInput"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10"
              :placeholder="isSetup ? 'Create a strong master password' : 'Enter your master password'"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
          
          <!-- Password Strength Indicator -->
          <div v-if="isSetup && password.length > 0" class="mt-2">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-muted-foreground">Password Strength:</span>
              <span class="text-xs font-semibold" :class="passwordStrength.color">
                {{ passwordStrength.feedback }}
              </span>
            </div>
            <div class="w-full bg-muted rounded-full h-2">
              <div
                class="h-2 rounded-full transition-all duration-300"
                :class="{
                  'bg-destructive': passwordStrength.score <= 2,
                  'bg-orange-500': passwordStrength.score > 2 && passwordStrength.score <= 4,
                  'bg-yellow-500': passwordStrength.score > 4 && passwordStrength.score <= 5,
                  'bg-green-500': passwordStrength.score > 5
                }"
                :style="{ width: `${(passwordStrength.score / 7) * 100}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Confirm Password (Setup Only) -->
        <div v-if="isSetup" class="space-y-2">
          <label class="text-sm font-medium text-card-foreground">
            Confirm Password
          </label>
          <div class="relative">
            <input
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              required
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10"
              placeholder="Re-enter your master password"
            />
            <button
              type="button"
              @click="showConfirmPassword = !showConfirmPassword"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg v-if="!showConfirmPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Security Question (Setup Only) -->
        <div v-if="isSetup" class="space-y-2">
          <label class="text-sm font-medium text-card-foreground">
            Security Question
          </label>
          <select
            v-model="selectedQuestionId"
            required
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>Choose a security question</option>
            <option
              v-for="q in securityQuestions"
              :key="q.id"
              :value="q.id"
            >
              {{ q.question }}
            </option>
          </select>
        </div>

        <!-- Security Answer (Setup Only) -->
        <div v-if="isSetup" class="space-y-2">
          <label class="text-sm font-medium text-card-foreground">
            Security Answer
          </label>
          <input
            v-model="securityAnswer"
            type="text"
            required
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Enter your answer (case-insensitive)"
          />
          <p class="text-xs text-muted-foreground mt-1">
            This will be used to reset your password if you forget it
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p class="text-sm text-destructive">{{ error }}</p>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="loading || (isSetup && passwordStrength.score < 5)"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
        >
          {{ loading ? 'Processing...' : (isSetup ? 'Create Vault' : 'Unlock Vault') }}
        </button>

        <!-- Forgot Password Link (Login Only) -->
        <div v-if="!isSetup" class="text-center">
          <button
            type="button"
            @click="showForgotPassword = true"
            class="text-sm text-primary hover:text-primary/90 transition-colors"
          >
            Forgot Password?
          </button>
        </div>
      </form>

      <!-- Setup Warnings -->
      <div v-if="isSetup" class="mt-6 space-y-4">
        <div class="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <p class="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>⚠️ Important:</strong> Your master password cannot be recovered. Make sure to remember it and your security answer!
          </p>
        </div>
        
        <div class="rounded-lg border border-primary/50 bg-primary/10 p-4">
          <p class="text-sm font-semibold mb-2 text-card-foreground">Password Requirements:</p>
          <ul class="text-xs text-muted-foreground space-y-1">
            <li>• At least 12 characters long</li>
            <li>• Contains uppercase and lowercase letters</li>
            <li>• Contains numbers</li>
            <li>• Contains special characters (!@#$%^&*)</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Forgot Password Modal -->
    <ForgotPasswordModal
      v-if="showForgotPassword"
      @close="showForgotPassword = false"
      @success="handlePasswordReset"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { SecurityUtils } from '../utils/security';
import { SecurityQuestionService, SECURITY_QUESTIONS } from '../services/securityQuestions';
import ForgotPasswordModal from './ForgotPasswordModal.vue';

const authStore = useAuthStore();

const password = ref('');
const confirmPassword = ref('');
const selectedQuestionId = ref<number | ''>('');
const securityAnswer = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const error = ref('');
const loading = ref(false);
const isSetup = ref(false);
const showForgotPassword = ref(false);

const securityQuestions = SECURITY_QUESTIONS;

const passwordStrength = computed(() => {
  return SecurityUtils.checkPasswordStrength(password.value);
});

onMounted(async () => {
  const hasPassword = await authStore.hasMasterPassword();
  isSetup.value = !hasPassword;
});

function onPasswordInput() {
  error.value = '';
}

async function handleSubmit() {
  error.value = '';
  loading.value = true;

  try {
    if (isSetup.value) {
      // Setup mode: create master password
      if (password.value !== confirmPassword.value) {
        error.value = 'Passwords do not match';
        return;
      }

      if (password.value.length < 12) {
        error.value = 'Password must be at least 12 characters long';
        return;
      }

      if (passwordStrength.value.score < 5) {
        error.value = 'Please choose a stronger password';
        return;
      }

      if (!selectedQuestionId.value) {
        error.value = 'Please select a security question';
        return;
      }

      if (!securityAnswer.value.trim()) {
        error.value = 'Please provide a security answer';
        return;
      }

      // Create master password
      await authStore.createMasterPassword(password.value);

      // Save security question
      await SecurityQuestionService.saveSecurityQuestion(
        selectedQuestionId.value as number,
        securityAnswer.value
      );
    } else {
      // Login mode: verify master password
      const success = await authStore.login(password.value);
      
      if (!success) {
        error.value = 'Incorrect master password';
        password.value = '';
      }
    }
  } catch (err: any) {
    error.value = err.message || 'An error occurred';
  } finally {
    loading.value = false;
  }
}

function handlePasswordReset() {
  showForgotPassword.value = false;
  // Reload the page to show login screen
  window.location.reload();
}
</script>