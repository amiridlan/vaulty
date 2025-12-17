<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">Reset Master Password</h2>
      
      <!-- Step 1: Show Security Question -->
      <div v-if="step === 1">
        <p class="text-sm text-gray-600 mb-4">
          Answer your security question to reset your master password.
        </p>

        <div v-if="securityQuestion" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p class="text-sm font-semibold text-blue-900 mb-2">Security Question:</p>
          <p class="text-sm text-blue-800">{{ securityQuestion.question }}</p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Your Answer
          </label>
          <input
            v-model="answer"
            type="text"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your answer"
            @keyup.enter="verifyAnswer"
          />
        </div>

        <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {{ error }}
        </div>

        <div class="flex gap-3">
          <button
            @click="$emit('close')"
            class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg transition duration-200"
          >
            Cancel
          </button>
          <button
            @click="verifyAnswer"
            :disabled="loading"
            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {{ loading ? 'Verifying...' : 'Verify' }}
          </button>
        </div>
      </div>

      <!-- Step 2: Set New Password -->
      <div v-if="step === 2">
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p class="text-sm text-yellow-800">
            <strong>⚠️ Warning:</strong> Resetting your password will delete all existing vault data. This cannot be undone.
          </p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            New Master Password
          </label>
          <input
            v-model="newPassword"
            type="password"
            required
            @input="checkPasswordStrength"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter new master password"
          />

          <!-- Password Strength Indicator -->
          <div v-if="newPassword.length > 0" class="mt-2">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-gray-600">Password Strength:</span>
              <span class="text-xs font-semibold" :class="passwordStrength.color">
                {{ passwordStrength.feedback }}
              </span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="h-2 rounded-full transition-all duration-300"
                :class="{
                  'bg-red-500': passwordStrength.score <= 2,
                  'bg-orange-500': passwordStrength.score > 2 && passwordStrength.score <= 4,
                  'bg-yellow-500': passwordStrength.score > 4 && passwordStrength.score <= 5,
                  'bg-green-500': passwordStrength.score > 5
                }"
                :style="{ width: `${(passwordStrength.score / 7) * 100}%` }"
              ></div>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Confirm New Password
          </label>
          <input
            v-model="confirmNewPassword"
            type="password"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Confirm new master password"
            @keyup.enter="resetPassword"
          />
        </div>

        <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {{ error }}
        </div>

        <div class="flex gap-3">
          <button
            @click="step = 1"
            class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg transition duration-200"
          >
            Back
          </button>
          <button
            @click="resetPassword"
            :disabled="loading || passwordStrength.score < 5"
            class="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg transition duration-200 disabled:opacity-50"
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