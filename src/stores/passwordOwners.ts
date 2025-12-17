import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getDatabase } from '../services/database';
import { EncryptionService } from '../services/encryption';
import type { PasswordOwner, PasswordEntry, DecryptedPasswordEntry } from '../types';

export const usePasswordOwnersStore = defineStore('passwordOwners', () => {
  const owners = ref<PasswordOwner[]>([]);
  const currentOwnerId = ref<number | null>(null);
  const passwordEntries = ref<DecryptedPasswordEntry[]>([]);

  // Load all password owners
  async function loadOwners(): Promise<void> {
    const db = await getDatabase();
    const result = await db.select(
      'SELECT * FROM password_owners ORDER BY name ASC'
    ) as PasswordOwner[];
    owners.value = result;
  }

  // Create a new password owner
  async function createOwner(name: string): Promise<void> {
    const db = await getDatabase();
    
    // Encrypt owner name (optional, for additional security)
    const encryptedData = EncryptionService.encrypt(JSON.stringify({ name }));

    await db.execute(
      'INSERT INTO password_owners (name, encrypted_data) VALUES (?, ?)',
      [name, encryptedData]
    );

    await loadOwners();
  }

  // Delete a password owner
  async function deleteOwner(ownerId: number): Promise<void> {
    const db = await getDatabase();
    
    // Delete owner (CASCADE will delete all entries)
    await db.execute(
      'DELETE FROM password_owners WHERE id = ?',
      [ownerId]
    );

    // Reset current owner if deleted
    if (currentOwnerId.value === ownerId) {
      currentOwnerId.value = null;
      passwordEntries.value = [];
    }

    await loadOwners();
  }

  // Select a password owner
  async function selectOwner(ownerId: number): Promise<void> {
    currentOwnerId.value = ownerId;
    await loadPasswordEntries(ownerId);
  }

  // Load password entries for an owner
  async function loadPasswordEntries(ownerId: number): Promise<void> {
    const db = await getDatabase();
    
    const entries = await db.select(
      'SELECT * FROM password_entries WHERE owner_id = ? ORDER BY created_at DESC',
      [ownerId]
    ) as PasswordEntry[];

    // Decrypt all entries
  passwordEntries.value = await Promise.all(
    entries.map(async (entry: PasswordEntry) => ({
      id: entry.id,
      owner_id: entry.owner_id,
      site: await EncryptionService.decrypt(entry.encrypted_site),
      username: await EncryptionService.decrypt(entry.encrypted_username),
      email: await EncryptionService.decrypt(entry.encrypted_email),
      password: await EncryptionService.decrypt(entry.encrypted_password),
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    }))
  );
  }

  // Add a new password entry
  async function addPasswordEntry(
    ownerId: number,
    site: string,
    username: string,
    email: string,
    password: string
  ): Promise<void> {
    const db = await getDatabase();

    // Encrypt all fields
    const encryptedSite = EncryptionService.encrypt(site);
    const encryptedUsername = EncryptionService.encrypt(username);
    const encryptedEmail = EncryptionService.encrypt(email);
    const encryptedPassword = EncryptionService.encrypt(password);

    await db.execute(
      `INSERT INTO password_entries 
       (owner_id, encrypted_site, encrypted_username, encrypted_email, encrypted_password) 
       VALUES (?, ?, ?, ?, ?)`,
      [ownerId, encryptedSite, encryptedUsername, encryptedEmail, encryptedPassword]
    );

    // Reload entries if viewing this owner
    if (currentOwnerId.value === ownerId) {
      await loadPasswordEntries(ownerId);
    }
  }

  async function updatePasswordEntry(
  entryId: number,
  site: string,
  username: string,
  email: string,
  password: string
): Promise<void> {
  const db = await getDatabase();

  // Encrypt all fields
  const encryptedSite = await EncryptionService.encrypt(site);
  const encryptedUsername = await EncryptionService.encrypt(username);
  const encryptedEmail = await EncryptionService.encrypt(email);
  const encryptedPassword = await EncryptionService.encrypt(password);

  await db.execute(
    `UPDATE password_entries 
     SET encrypted_site = ?, encrypted_username = ?, encrypted_email = ?, 
         encrypted_password = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [encryptedSite, encryptedUsername, encryptedEmail, encryptedPassword, entryId]
  );

  // Reload entries
  if (currentOwnerId.value !== null) {
    await loadPasswordEntries(currentOwnerId.value);
  }
}

  // Delete a password entry
  async function deletePasswordEntry(entryId: number): Promise<void> {
    const db = await getDatabase();

    await db.execute(
      'DELETE FROM password_entries WHERE id = ?',
      [entryId]
    );

    // Reload entries
    if (currentOwnerId.value !== null) {
      await loadPasswordEntries(currentOwnerId.value);
    }
  }

  // Search password entries
  function searchEntries(query: string): DecryptedPasswordEntry[] {
    if (!query.trim()) return passwordEntries.value;

    const lowerQuery = query.toLowerCase();
    return passwordEntries.value.filter(entry =>
      entry.site.toLowerCase().includes(lowerQuery) ||
      entry.username.toLowerCase().includes(lowerQuery) ||
      entry.email.toLowerCase().includes(lowerQuery)
    );
  }

  return {
    owners,
    currentOwnerId,
    passwordEntries,
    loadOwners,
    createOwner,
    deleteOwner,
    selectOwner,
    loadPasswordEntries,
    addPasswordEntry,
    updatePasswordEntry,
    deletePasswordEntry,
    searchEntries,
  };
});