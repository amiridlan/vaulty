import { getDatabase } from './database';
import { VaultIdentityService } from './vaultIdentity';
import type { MasterPassword, PasswordOwner, PasswordEntry } from '../types';

export interface SyncPayload {
  version: 1;
  vault_public_key: string;
  sent_at: number;
  master_password: MasterPassword | null;
  password_owners: PasswordOwner[];
  password_entries: PasswordEntry[];
}

export interface MergeResult {
  owners_added: number;
  owners_updated: number;
  entries_added: number;
  entries_updated: number;
}

export async function buildSyncPayload(vaultPublicKey: string): Promise<string> {
  const db = await getDatabase();

  const [mpRows, ownerRows, entryRows] = await Promise.all([
    db.select('SELECT * FROM master_password WHERE id = 1') as Promise<MasterPassword[]>,
    db.select('SELECT * FROM password_owners') as Promise<PasswordOwner[]>,
    db.select('SELECT * FROM password_entries') as Promise<PasswordEntry[]>,
  ]);

  const payload: SyncPayload = {
    version: 1,
    vault_public_key: vaultPublicKey,
    sent_at: Math.floor(Date.now() / 1000),
    master_password: mpRows[0] ?? null,
    password_owners: ownerRows,
    password_entries: entryRows,
  };

  return JSON.stringify(payload);
}

export async function mergeSyncPayload(raw: string): Promise<MergeResult> {
  const payload: SyncPayload = JSON.parse(raw);
  if (payload.version !== 1) throw new Error(`Unknown sync payload version: ${payload.version}`);

  // Verify vault identity — reject data from a different vault.
  // Exception: pending-join device (empty encrypted_secret) accepts the first payload
  // it receives, which is how it bootstraps the vault data.
  const localIdentity = await VaultIdentityService.getVaultIdentity();
  if (localIdentity && localIdentity.encrypted_secret) {
    if (payload.vault_public_key !== localIdentity.vault_public_key) {
      throw new Error(
        `Sync rejected: payload vault key "${payload.vault_public_key.slice(0, 8)}…" does not match local vault`,
      );
    }
  }

  const db = await getDatabase();
  const result: MergeResult = { owners_added: 0, owners_updated: 0, entries_added: 0, entries_updated: 0 };

  // ── master_password: only sync if local has none (pending-join device) ──────
  if (payload.master_password) {
    const local = await db.select('SELECT id FROM master_password WHERE id = 1') as { id: number }[];
    if (local.length === 0) {
      const mp = payload.master_password;
      await db.execute(
        'INSERT INTO master_password (id, password_hash, salt) VALUES (1, ?, ?)',
        [mp.password_hash, mp.salt],
      );
    }
  }

  // ── password_owners: merge by sync_id, last-write-wins by updated_at ────────
  for (const remote of payload.password_owners) {
    if (!remote.sync_id) continue;

    const existing = await db.select(
      'SELECT id, updated_at FROM password_owners WHERE sync_id = ?',
      [remote.sync_id],
    ) as { id: number; updated_at: string }[];

    if (existing.length === 0) {
      // Insert — use remote name if no conflict, otherwise skip (name is UNIQUE)
      try {
        await db.execute(
          'INSERT INTO password_owners (name, encrypted_data, sync_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [remote.name, remote.encrypted_data, remote.sync_id, remote.created_at, remote.updated_at],
        );
        result.owners_added++;
      } catch {
        // Name conflict: a different owner already has this name locally; skip.
      }
    } else if (remote.updated_at > existing[0].updated_at) {
      await db.execute(
        'UPDATE password_owners SET name = ?, encrypted_data = ?, updated_at = ? WHERE sync_id = ?',
        [remote.name, remote.encrypted_data, remote.updated_at, remote.sync_id],
      );
      result.owners_updated++;
    }
  }

  // ── password_entries: merge by sync_id, resolving owner_id locally ──────────
  // Build a sync_id → local id map for owners so we can assign the correct local owner_id
  const ownerMap = await db.select(
    'SELECT id, sync_id FROM password_owners WHERE sync_id IS NOT NULL',
  ) as { id: number; sync_id: string }[];
  const ownerSyncToLocalId = new Map(ownerMap.map((o) => [o.sync_id, o.id]));

  for (const remote of payload.password_entries) {
    if (!remote.sync_id) continue;

    // Find the owner's sync_id from the remote payload to resolve local owner_id
    const remoteOwner = payload.password_owners.find((o) => o.id === remote.owner_id);
    if (!remoteOwner?.sync_id) continue;

    const localOwnerId = ownerSyncToLocalId.get(remoteOwner.sync_id);
    if (!localOwnerId) continue; // Owner wasn't synced yet; skip this entry

    const existing = await db.select(
      'SELECT id, updated_at FROM password_entries WHERE sync_id = ?',
      [remote.sync_id],
    ) as { id: number; updated_at: string }[];

    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO password_entries
         (owner_id, encrypted_site, encrypted_username, encrypted_email, encrypted_password, encrypted_extra_fields, sync_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          localOwnerId,
          remote.encrypted_site,
          remote.encrypted_username,
          remote.encrypted_email,
          remote.encrypted_password,
          remote.encrypted_extra_fields ?? null,
          remote.sync_id,
          remote.created_at,
          remote.updated_at,
        ],
      );
      result.entries_added++;
    } else if (remote.updated_at > existing[0].updated_at) {
      await db.execute(
        `UPDATE password_entries
         SET owner_id = ?, encrypted_site = ?, encrypted_username = ?,
             encrypted_email = ?, encrypted_password = ?, encrypted_extra_fields = ?, updated_at = ?
         WHERE sync_id = ?`,
        [
          localOwnerId,
          remote.encrypted_site,
          remote.encrypted_username,
          remote.encrypted_email,
          remote.encrypted_password,
          remote.encrypted_extra_fields ?? null,
          remote.updated_at,
          remote.sync_id,
        ],
      );
      result.entries_updated++;
    }
  }

  return result;
}
