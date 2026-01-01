<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-card rounded-lg shadow-2xl p-8 w-full max-w-md border border-border">
      <h2 class="text-2xl font-bold text-foreground mb-4">Reset Master Password</h2>
      
      <!-- Step 1: Show Security Question -->
      <div v-if="step === 1">
        <p class="text-sm text-muted-foreground mb-4">
          Answer your security question to reset your master password.
        </p>

        <div v-if="securityQuestion" class="rounded-lg border border-primary/50 bg-primary/10 p-4 mb-4">
          <p class="text-sm font-semibold text-foreground mb-2">Security Question:</p>
          <p class="text-sm text-muted-foreground">{{ securityQuestion.question }}</p>
        </div>

        <div class="mb-4 space-y-2">
          <label class="text-sm font-medium text-foreground">
            Your Answer
          </label>
          <input
            v-model="answer"
            type="text"
            required
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Enter your answer"
            @keyup.enter="verifyAnswer"
          />
        </div>

        <div v-if="error" class="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 mb-4">
          <p class="text-sm text-destructive">{{ error }}</p>
        </div>

        <div class="flex gap-3">
          <button
            @click="$emit('close')"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 flex-1"
          >
            Cancel
          </button>
          <button
            @click="verifyAnswer"
            :disabled="loading"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 flex-1"
          >
            {{ loading ? 'Verifying...' : 'Verify' }}
          </button>
        </div>
      </div>

      <!-- Step 2: Set New Password -->
      <div v-if="step === 2">
        <div class="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 mb-4">
          <p class="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>⚠️ Warning:</strong> Resetting your password will delete all existing vault data. This cannot be undone.
          </p>
        </div>

        <div class="mb-4 space-y-2">
          <label class="text-sm font-medium text-foreground">
            New Master Password
          </label>
          <input
            v-model="newPassword"
            type="password"
            required
            @input="checkPasswordStrength"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Enter new master password"
          />

          <!-- Password Strength Indicator -->
          <div v-if="newPassword.length > 0" class="mt-2">
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

        <div class="mb-4 space-y-2">
          <label class="text-sm font-medium text-foreground">
            Confirm New Password
          </label>
          <input
            v-model="confirmNewPassword"
            type="password"
            required
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Confirm new master password"
            @keyup.enter="resetPassword"
          />
        </div>

        <div v-if="error" class="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 mb-4">
          <p class="text-sm text-destructive">{{ error }}</p>
        </div>

        <div class="flex gap-3">
          <button
            @click="step = 1"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 flex-1"
          >
            Back
          </button>
          <button
            @click="resetPassword"
            :disabled="loading || passwordStrength.score < 5"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2 flex-1"
          >
            {{ loading ? 'Resetting...' : 'Reset Password' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { SecurityQuestionService, type SecurityQuestion } from '../services/securityQuestions';
import { SecurityUtils } from '../utils/security';

const emit = defineEmits<{
  close: []
  success: []
}>();

const step = ref(1);
const securityQuestion = ref<SecurityQuestion | null>(null);
const answer = ref('');
const newPassword = ref('');
const confirmNewPassword = ref('');
const error = ref('');
const loading = ref(false);

const passwordStrength = computed(() => {
  return SecurityUtils.checkPasswordStrength(newPassword.value);
});

onMounted(async () => {
  try {
    securityQuestion.value = await SecurityQuestionService.getSecurityQuestion();
    if (!securityQuestion.value) {
      error.value = 'No security question found';
    }
  } catch (err: any) {
    error.value = 'Failed to load security question';
  }
});

function checkPasswordStrength() {
  error.value = '';
}

async function verifyAnswer() {
  error.value = '';
  loading.value = true;

  try {
    const isValid = await SecurityQuestionService.verifySecurityAnswer(answer.value);
    
    if (isValid) {
      step.value = 2;
    } else {
      error.value = 'Incorrect answer. Please try again.';
    }
  } catch (err: any) {
    error.value = err.message || 'Verification failed';
  } finally {
    loading.value = false;
  }
}

async function resetPassword() {
  error.value = '';

  // Validation
  if (newPassword.value.length < 12) {
    error.value = 'Password must be at least 12 characters long';
    return;
  }

  if (passwordStrength.value.score < 5) {
    error.value = 'Please choose a stronger password';
    return;
  }

  if (newPassword.value !== confirmNewPassword.value) {
    error.value = 'Passwords do not match';
    return;
  }

  // Final confirmation
  if (!confirm('This will delete all your existing vault data. Are you absolutely sure?')) {
    return;
  }

  loading.value = true;

  try {
    await SecurityQuestionService.resetMasterPassword(answer.value, newPassword.value);
    
    alert('Master password has been reset successfully! All previous data has been deleted. You can now log in with your new password.');
    emit('success');
  } catch (err: any) {
    error.value = err.message || 'Failed to reset password';
  } finally {
    loading.value = false;
  }
}
</script>