<template>
  <div class="w-full">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <h2 class="text-xl sm:text-2xl font-bold text-foreground">Password Owners</h2>
      <button
        @click="showAddModal = true"
        class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-auto"
      >
        + Add Owner
      </button>
    </div>

    <div v-if="owners.length === 0" class="text-center py-12">
      <p class="text-muted-foreground text-base sm:text-lg">No password owners yet. Create one to get started!</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="owner in owners"
        :key="owner.id"
        @click="handleSelectOwner(owner.id)"
        class="bg-card border-2 rounded-lg p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
        :class="currentOwnerId === owner.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'"
      >
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <h3 class="text-lg sm:text-xl font-semibold text-foreground mb-2 truncate">{{ owner.name }}</h3>
            <p class="text-xs sm:text-sm text-muted-foreground">
              Created: {{ formatDate(owner.created_at) }}
            </p>
          </div>
          <button
            @click.stop="confirmDeleteOwner(owner.id, owner.name)"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 hover:text-destructive h-9 w-9 ml-2 flex-shrink-0"
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
    <div v-if="showAddModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-card rounded-lg shadow-2xl p-6 w-full max-w-md border border-border">
        <h3 class="text-xl font-bold text-foreground mb-4">Add Password Owner</h3>
        
        <form @submit.prevent="handleAddOwner">
          <div class="mb-4 space-y-2">
            <label class="text-sm font-medium text-foreground">
              Owner Name
            </label>
            <input
              v-model="newOwnerName"
              type="text"
              required
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="e.g., Wife, Husband, Son"
            />
          </div>

          <div v-if="error" class="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p class="text-sm text-destructive">{{ error }}</p>
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              @click="closeAddModal"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 flex-1"
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