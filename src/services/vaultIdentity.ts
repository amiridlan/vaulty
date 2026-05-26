import { invoke } from '@tauri-apps/api/core';
import { getDatabase } from './database';
import { isDesktopApp } from '../utils/tauri';

export interface VaultKeypairData {
  vault_public_key: string;
  encrypted_secret: string;
  kdf_salt: string;
  aes_nonce: string;
}

export interface VaultIdentityRow extends VaultKeypairData {
  id: number;
  created_at: string;
}

export class VaultIdentityService {
  static async hasVaultIdentity(): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.select(
      'SELECT id FROM vault_identity WHERE id = 1'
    ) as any[];
    return result.length > 0;
  }

  static async getVaultIdentity(): Promise<VaultIdentityRow | null> {
    const db = await getDatabase();
    const result = await db.select(
      'SELECT * FROM vault_identity WHERE id = 1'
    ) as VaultIdentityRow[];
    return result.length > 0 ? result[0] : null;
  }

  /// Generate a new Ed25519 vault keypair in Rust, store encrypted in SQLite.
  /// Returns the vault_public_key — the bs58 string shown to the user as their "sync code".
  static async generateAndStore(masterPassword: string): Promise<string> {
    if (!isDesktopApp()) {
      // Web fallback: P2P sync requires the desktop app, use a placeholder.
      const placeholder = `WEB-${Date.now()}`;
      const db = await getDatabase();
      await db.execute(
        'INSERT INTO vault_identity (id, vault_public_key, encrypted_secret, kdf_salt, aes_nonce) VALUES (1, ?, ?, ?, ?)',
        [placeholder, '', '', '']
      );
      return placeholder;
    }

    const data = await invoke<VaultKeypairData>('generate_vault_keypair', { masterPassword });
    const db = await getDatabase();
    await db.execute(
      'INSERT INTO vault_identity (id, vault_public_key, encrypted_secret, kdf_salt, aes_nonce) VALUES (1, ?, ?, ?, ?)',
      [data.vault_public_key, data.encrypted_secret, data.kdf_salt, data.aes_nonce]
    );
    return data.vault_public_key;
  }

  /// Store a remote vault's sync code as a pending join target.
  /// encrypted_secret is left empty — the full keypair arrives via P2P sync in Sprint 3.
  static async storePendingJoin(syncCode: string): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      'INSERT OR REPLACE INTO vault_identity (id, vault_public_key, encrypted_secret, kdf_salt, aes_nonce) VALUES (1, ?, ?, ?, ?)',
      [syncCode, '', '', '']
    );
  }

  /// Validate that a sync code is a correctly-encoded Ed25519 public key.
  static async validateSyncCode(code: string): Promise<boolean> {
    if (!isDesktopApp()) return false;
    return invoke<boolean>('validate_sync_code', { code });
  }

  /// A row with empty encrypted_secret is a pending join awaiting P2P sync.
  static isPendingJoin(identity: VaultIdentityRow): boolean {
    return !identity.encrypted_secret;
  }
}
