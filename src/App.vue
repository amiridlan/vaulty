<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { initDatabase } from './services/database';
import { isDesktopApp, waitForTauri } from './utils/tauri';
import Login from './components/Login.vue';
import Dashboard from './components/Dashboard.vue';

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const loading = ref(true);
const error = ref('');
const errorDetails = ref('');
const environment = ref('');

async function initialize() {
  loading.value = true;
  error.value = '';
  errorDetails.value = '';
  
  try {
    if (isDesktopApp()) {
      // Desktop app: Wait for Tauri
      environment.value = 'Desktop';
      console.log('Running as Desktop app...');
      
      const tauriReady = await waitForTauri(10000);
      
      if (!tauriReady) {
        throw new Error('Tauri API not available. Make sure you are running this app with Tauri.');
      }
      
      console.log('Tauri API ready, initializing database...');
    } else {
      // Web app: Use browser storage
      environment.value = 'Web';
      console.log('Running as Web app...');
    }
    
    await initDatabase();
    
    console.log('Initialization complete!');
    loading.value = false;
  } catch (err: any) {
    console.error('Initialization error:', err);
    error.value = err.message || 'Failed to initialize application';
    errorDetails.value = err.stack || JSON.stringify(err, null, 2);
    loading.value = false;
  }
}

function retryInit() {
  initialize();
}

onMounted(() => {
  setTimeout(() => {
    initialize();
  }, 100);
});
</script>

<template>
  <div id="app">
    <div v-if="loading" class="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
      <div class="text-white text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
        <p class="text-xl">Initializing Password Vault...</p>
        <p class="text-sm mt-2 opacity-75">{{ environment }} Version</p>
      </div>
    </div>
    
    <div v-else-if="error" class="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl p-8 max-w-md">
        <h2 class="text-2xl font-bold text-red-600 mb-4">Initialization Error</h2>
        <p class="text-gray-700 mb-4">{{ error }}</p>
        <div v-if="!isDesktopApp()" class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <p class="text-sm text-blue-800">
            <strong>Note:</strong> You're running the web version. Some features may be limited compared to the desktop app.
          </p>
        </div>
        <pre v-if="errorDetails" class="text-xs text-gray-600 bg-gray-100 p-2 rounded mb-4 overflow-auto max-h-40">{{ errorDetails }}</pre>
        <button 
          @click="retryInit"
          class="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition duration-200"
        >
          Retry
        </button>
      </div>
    </div>
    
    <template v-else>
      <Login v-if="!isAuthenticated" />
      <Dashboard v-else />
    </template>
  </div>
</template>