import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getDatabase } from '../services/database';
import { EncryptionService } from '../services/encryption';
import type { MasterPassword } from '../types';

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false);
  const lastActivityTime = ref<number>(Date.now());
  const autoLogoutTimer = ref<number | null>(null);
  const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes in milliseconds

  // Check if master password exists
  async function hasMasterPassword(): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.select(
      'SELECT * FROM master_password WHERE id = 1'
    ) as MasterPassword[];
    return result.length > 0;
  }

  // Create master password (first time setup)
  async function createMasterPassword(password: string): Promise<void> {
    const db = await getDatabase();
    
    // Generate salt and hash password
    const salt = EncryptionService.generateSalt();
    const passwordHash = await EncryptionService.hashMasterPassword(password, salt);

    // Store in database
    await db.execute(
      'INSERT INTO master_password (id, password_hash, salt) VALUES (1, ?, ?)',
      [passwordHash, salt]
    );

    // Derive encryption key and set it
    const encryptionKey = await EncryptionService.deriveEncryptionKey(password, salt);
    EncryptionService.setEncryptionKey(encryptionKey);

    isAuthenticated.value = true;
    startAutoLogoutTimer();
  }

  // Verify master password and login
  async function login(password: string): Promise<boolean> {
    const db = await getDatabase();
    
    // Get stored hash and salt
    const result = await db.select(
      'SELECT * FROM master_password WHERE id = 1'
    ) as MasterPassword[];

    if (result.length === 0) {
      throw new Error('Master password not set');
    }

    const { password_hash, salt } = result[0];

    // Hash provided password with stored salt
    const inputHash = await EncryptionService.hashMasterPassword(password, salt);

    // Compare hashes
    if (inputHash === password_hash) {
      // Derive encryption key
      const encryptionKey = await EncryptionService.deriveEncryptionKey(password, salt);
      EncryptionService.setEncryptionKey(encryptionKey);

      isAuthenticated.value = true;
      startAutoLogoutTimer();
      return true;
    }

    return false;
  }

  // Logout
  function logout() {
    isAuthenticated.value = false;
    EncryptionService.clearEncryptionKey();
    stopAutoLogoutTimer();
  }

  // Update activity timestamp
  function updateActivity() {
    lastActivityTime.value = Date.now();
  }

  // Start auto-logout timer
  function startAutoLogoutTimer() {
    stopAutoLogoutTimer(); // Clear any existing timer

    autoLogoutTimer.value = window.setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTime.value;

      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        logout();
      }
    }, 1000); // Check every second
  }

  // Stop auto-logout timer
  function stopAutoLogoutTimer() {
    if (autoLogoutTimer.value !== null) {
      clearInterval(autoLogoutTimer.value);
      autoLogoutTimer.value = null;
    }
  }

  return {
    isAuthenticated: computed(() => isAuthenticated.value),
    lastActivityTime: computed(() => lastActivityTime.value),
    hasMasterPassword,
    createMasterPassword,
    login,
    logout,
    updateActivity,
  };
});