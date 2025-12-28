<template>
  <div class="w-full">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <h2 class="text-xl sm:text-2xl font-bold text-gray-800">Password Owners</h2>
      <button
        @click="showAddModal = true"
        class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
      >
        + Add Owner
      </button>
    </div>

    <div v-if="owners.length === 0" class="text-center py-12">
      <p class="text-gray-500 text-base sm:text-lg">No password owners yet. Create one to get started!</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="owner in owners"
        :key="owner.id"
        @click="handleSelectOwner(owner.id)"
        class="bg-white border-2 border-gray-200 rounded-lg p-4 sm:p-6 cursor-pointer hover:border-blue-500 hover:shadow-lg transition duration-200"
        :class="{ 'border-blue-500 bg-blue-50': currentOwnerId === owner.id }"
      >
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <h3 class="text-lg sm:text-xl font-semibold text-gray-800 mb-2 truncate">{{ owner.name }}</h3>
            <p class="text-xs sm:text-sm text-gray-500">
              Created: {{ formatDate(owner.created_at) }}
            </p>
          </div>
          <button
            @click.stop="confirmDeleteOwner(owner.id, owner.name)"
            class="text-red-500 hover:text-red-700 transition duration-200 ml-2 flex-shrink-0"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Owner Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteConfirm"
      title="Delete Password Owner"
      :message="`Are you sure you want to delete &quot;${pendingDeleteOwner?.name}&quot; and all associated passwords? This action cannot be undone.`"
      confirm-text="Delete Owner"
      cancel-text="Cancel"
      icon="danger"
      @confirm="handleDeleteConfirmed"
      @cancel="handleDeleteCancelled"
    />

    <!-- Add Owner Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-xl font-bold text-gray-800 mb-4">Add Password Owner</h3>
        
        <form @submit.prevent="handleAddOwner">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Owner Name
            </label>
            <input
              v-model="newOwnerName"
              type="text"
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Wife, Husband, Son"
            />
          </div>

          <div v-if="error" class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {{ error }}
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              @click="closeAddModal"
              class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg transition duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition duration-200"
            >
              Add Owner
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { usePasswordOwnersStore } from '../stores/passwordOwners';
import ConfirmationModal from './ConfirmationModal.vue';

const emit = defineEmits<{
  ownerSelected: [ownerId: number]
}>();

const store = usePasswordOwnersStore();

const showAddModal = ref(false);
const newOwnerName = ref('');
const error = ref('');

// Confirmation modal state
const showDeleteConfirm = ref(false);
const pendingDeleteOwner = ref<{ id: number; name: string } | null>(null);

const owners = computed(() => store.owners);
const currentOwnerId = computed(() => store.currentOwnerId);

onMounted(async () => {
  await store.loadOwners();
});

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

async function handleAddOwner() {
  error.value = '';

  try {
    await store.createOwner(newOwnerName.value);
    closeAddModal();
  } catch (err: any) {
    error.value = err.message || 'Failed to add owner';
  }
}

function closeAddModal() {
  showAddModal.value = false;
  newOwnerName.value = '';
  error.value = '';
}

async function handleSelectOwner(ownerId: number) {
  await store.selectOwner(ownerId);
  emit('ownerSelected', ownerId);
}

// FIXED: Show modal and store pending owner
function confirmDeleteOwner(ownerId: number, ownerName: string) {
  pendingDeleteOwner.value = { id: ownerId, name: ownerName };
  showDeleteConfirm.value = true;
}

async function handleDeleteConfirmed() {
  if (!pendingDeleteOwner.value) return;
  
  try {
    await store.deleteOwner(pendingDeleteOwner.value.id);
  } catch (err: any) {
    error.value = err.message || 'Failed to delete owner';
  } finally {
    showDeleteConfirm.value = false;
    pendingDeleteOwner.value = null;
  }
}

function handleDeleteCancelled() {
  showDeleteConfirm.value = false;
  pendingDeleteOwner.value = null;
}

</script>