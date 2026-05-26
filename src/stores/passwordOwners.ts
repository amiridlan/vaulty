import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getDatabase } from '../services/database';
import { EncryptionService } from '../services/encryption';
import type { PasswordOwner, PasswordEntry, DecryptedPasswordEntry, ExtraField } from '../types';

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
    const syncId = crypto.randomUUID();

    await db.execute(
      'INSERT INTO password_owners (name, encrypted_data, sync_id) VALUES (?, ?, ?)',
      [name, encryptedData, syncId]
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
    entries.map(async (entry: PasswordEntry) => {
      let extra_fields: ExtraField[] = [];
      if (entry.encrypted_extra_fields) {
        try {
          const raw = await EncryptionService.decrypt(entry.encrypted_extra_fields);
          extra_fields = JSON.parse(raw);
        } catch {
          extra_fields = [];
        }
      }
      return {
        id: entry.id,
        owner_id: entry.owner_id,
        site: await EncryptionService.decrypt(entry.encrypted_site),
        username: await EncryptionService.decrypt(entry.encrypted_username),
        email: await EncryptionService.decrypt(entry.encrypted_email),
        password: await EncryptionService.decrypt(entry.encrypted_password),
        extra_fields,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      };
    })
  );
  }

  // Add a new password entry
  async function addPasswordEntry(
    ownerId: number,
    site: string,
    username: string,
    email: string,
    password: string,
    extraFields: ExtraField[] = []
  ): Promise<void> {
    const db = await getDatabase();

    const encryptedSite = EncryptionService.encrypt(site);
    const encryptedUsername = EncryptionService.encrypt(username);
    const encryptedEmail = EncryptionService.encrypt(email);
    const encryptedPassword = EncryptionService.encrypt(password);
    const encryptedExtraFields = extraFields.length > 0
      ? EncryptionService.encrypt(JSON.stringify(extraFields))
      : null;
    const syncId = crypto.randomUUID();

    await db.execute(
      `INSERT INTO password_entries
       (owner_id, encrypted_site, encrypted_username, encrypted_email, encrypted_password, encrypted_extra_fields, sync_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ownerId, encryptedSite, encryptedUsername, encryptedEmail, encryptedPassword, encryptedExtraFields, syncId]
    );

    if (currentOwnerId.value === ownerId) {
      await loadPasswordEntries(ownerId);
    }
  }

  async function updatePasswordEntry(
    entryId: number,
    site: string,
    username: string,
    email: string,
    password: string,
    extraFields: ExtraField[] = []
  ): Promise<void> {
    const db = await getDatabase();

    const encryptedSite = EncryptionService.encrypt(site);
    const encryptedUsername = EncryptionService.encrypt(username);
    const encryptedEmail = EncryptionService.encrypt(email);
    const encryptedPassword = EncryptionService.encrypt(password);
    const encryptedExtraFields = extraFields.length > 0
      ? EncryptionService.encrypt(JSON.stringify(extraFields))
      : null;

    await db.execute(
      `UPDATE password_entries
       SET encrypted_site = ?, encrypted_username = ?, encrypted_email = ?,
           encrypted_password = ?, encrypted_extra_fields = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [encryptedSite, encryptedUsername, encryptedEmail, encryptedPassword, encryptedExtraFields, entryId]
    );

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