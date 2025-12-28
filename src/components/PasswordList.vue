<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">
          {{ currentOwnerName }}'s Passwords
        </h2>
        <p class="text-sm text-gray-500 mt-1">{{ filteredEntries.length }} entries</p>
      </div>
      <button
        @click="showAddModal = true"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
      >
        + Add Password
      </button>
    </div>

    <!-- Search bar -->
    <div class="mb-6">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by site, username, or email..."
        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <!-- Password entries -->
    <div v-if="filteredEntries.length === 0" class="text-center py-12">
      <p class="text-gray-500 text-lg">
        {{ searchQuery ? 'No passwords found matching your search.' : 'No passwords yet. Add one to get started!' }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <PasswordEntry
        v-for="entry in filteredEntries"
        :key="entry.id"
        :entry="entry"
        @edit="handleEdit"
        @delete="confirmDelete"
      />
    </div>

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteConfirm"
      title="Delete Password Entry"
      message="Are you sure you want to delete this password entry? This action cannot be undone."
      confirm-text="Delete"
      cancel-text="Cancel"
      icon="danger"
      @confirm="handleDeleteConfirmed"
      @cancel="handleDeleteCancelled"
    />

    <!-- Add/Edit Password Modal -->
    <div v-if="showAddModal || showEditModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold text-gray-800 mb-4">
          {{ showEditModal ? 'Edit Password' : 'Add New Password' }}
        </h3>
        
        <form @submit.prevent="showEditModal ? handleUpdateEntry() : handleAddEntry()">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Site/App Name *
              </label>
              <input
                v-model="formData.site"
                type="text"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Facebook, Gmail, Netflix"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                v-model="formData.username"
                type="text"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                v-model="formData.email"
                type="email"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter email"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div class="relative">
                <input
                  v-model="formData.password"
                  :type="showPasswordInput ? 'text' : 'password'"
                  required
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  @click="showPasswordInput = !showPasswordInput"
                  class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <svg v-if="!showPasswordInput" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="button"
              @click="generatePassword"
              class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg transition duration-200"
            >
              Generate Strong Password
            </button>
          </div>

          <div v-if="error" class="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {{ error }}
          </div>

          <div class="flex gap-3 mt-6">
            <button
              type="button"
              @click="closeModal"
              class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg transition duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition duration-200"
            >
              {{ showEditModal ? 'Update' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePasswordOwnersStore } from '../stores/passwordOwners';
import PasswordEntry from './PasswordEntry.vue';
import ConfirmationModal from './ConfirmationModal.vue';
import type { DecryptedPasswordEntry } from '../types';
import { SecurityUtils } from '../utils/security';

const store = usePasswordOwnersStore();

const showAddModal = ref(false);
const showEditModal = ref(false);
const showPasswordInput = ref(false);
const searchQuery = ref('');
const error = ref('');

// Confirmation modal state
const showDeleteConfirm = ref(false);
const pendingDeleteId = ref<number | null>(null);

const formData = ref({
  site: '',
  username: '',
  email: '',
  password: ''
});

const editingEntryId = ref<number | null>(null);

const currentOwnerName = computed(() => {
  const owner = store.owners.find(o => o.id === store.currentOwnerId);
  return owner?.name || '';
});

const filteredEntries = computed(() => {
  return store.searchEntries(searchQuery.value);
});

function generatePassword() {
  formData.value.password = SecurityUtils.generateSecurePassword(16);
}

async function handleAddEntry() {
  error.value = '';

  try {
    if (!store.currentOwnerId) {
      error.value = 'No owner selected';
      return;
    }

    await store.addPasswordEntry(
      store.currentOwnerId,
      formData.value.site,
      formData.value.username,
      formData.value.email,
      formData.value.password
    );

    closeModal();
  } catch (err: any) {
    error.value = err.message || 'Failed to add password';
  }
}

function handleEdit(entry: DecryptedPasswordEntry) {
  editingEntryId.value = entry.id;
  formData.value = {
    site: entry.site,
    username: entry.username,
    email: entry.email,
    password: entry.password
  };
  showEditModal.value = true;
}

async function handleUpdateEntry() {
  error.value = '';

  try {
    if (editingEntryId.value === null) {
      error.value = 'No entry selected';
      return;
    }

    await store.updatePasswordEntry(
      editingEntryId.value,
      formData.value.site,
      formData.value.username,
      formData.value.email,
      formData.value.password
    );

    closeModal();
  } catch (err: any) {
    error.value = err.message || 'Failed to update password';
  }
}

// FIXED: Show modal and store pending ID
function confirmDelete(entryId: number) {
  pendingDeleteId.value = entryId;
  showDeleteConfirm.value = true;
}

async function handleDeleteConfirmed() {
  if (pendingDeleteId.value === null) return;
  
  try {
    await store.deletePasswordEntry(pendingDeleteId.value);
  } catch (err: any) {
    error.value = err.message || 'Failed to delete password';
  } finally {
    showDeleteConfirm.value = false;
    pendingDeleteId.value = null;
  }
}

function handleDeleteCancelled() {
  showDeleteConfirm.value = false;
  pendingDeleteId.value = null;
}

async function handleDelete(entryId: number) {
  try {
    await store.deletePasswordEntry(entryId);
  } catch (err: any) {
    error.value = err.message || 'Failed to delete password';
  }
}

function closeModal() {
  showAddModal.value = false;
  showEditModal.value = false;
  showPasswordInput.value = false;
  editingEntryId.value = null;
  error.value = '';
  formData.value = {
    site: '',
    username: '',
    email: '',
    password: ''
  };
}
</script>