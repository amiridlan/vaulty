<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-foreground">
          {{ currentOwnerName }}'s Passwords
        </h2>
        <p class="text-sm text-muted-foreground mt-1">{{ filteredEntries.length }} entries</p>
      </div>
      <button
        @click="showAddModal = true"
        class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
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
        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>

    <!-- Password entries -->
    <div v-if="filteredEntries.length === 0" class="text-center py-12">
      <p class="text-muted-foreground text-lg">
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
    <div v-if="showAddModal || showEditModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-card rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-border shadow-lg">
        <h3 class="text-xl font-bold text-foreground mb-4">
          {{ showEditModal ? 'Edit Password' : 'Add New Password' }}
        </h3>
        
        <form @submit.prevent="showEditModal ? handleUpdateEntry() : handleAddEntry()">
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">
                Site/App Name *
              </label>
              <input
                v-model="formData.site"
                type="text"
                required
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g., Facebook, Gmail, Netflix"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">
                Username
              </label>
              <input
                v-model="formData.username"
                type="text"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter username"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                v-model="formData.email"
                type="email"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter email"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">
                Password *
              </label>
              <div class="relative">
                <input
                  v-model="formData.password"
                  :type="showPasswordInput ? 'text' : 'password'"
                  required
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-12"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  @click="showPasswordInput = !showPasswordInput"
                  class="absolute right-1.5 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-muted"
                >
                  <Eye v-if="!showPasswordInput" :size="16" :stroke-width="2.5" />
                  <EyeOff v-else :size="16" :stroke-width="2.5" />
                </button>
              </div>
            </div>

            <button
              type="button"
              @click="generatePassword"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm text-foreground font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full"
            >
              Generate Strong Password
            </button>
          </div>

          <div v-if="error" class="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p class="text-sm text-destructive">{{ error }}</p>
          </div>

          <div class="flex gap-3 mt-6">
            <button
              type="button"
              @click="closeModal"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm text-foreground font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 flex-1"
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
import { Eye, EyeOff } from 'lucide-vue-next';

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