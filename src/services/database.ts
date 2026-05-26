import Database from '@tauri-apps/plugin-sql';
import { BrowserDatabase, initBrowserDatabase } from './browserDatabase';
import { isDesktopApp } from '../utils/tauri';

let db: Database | null = null;
let initPromise: Promise<any> | null = null;

export async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (isDesktopApp()) {
        // Desktop: Use Tauri SQL
        db = await Database.load('sqlite:password_vault.db');
        await createTables();
        return db;
      } else {
        // Browser: Use IndexedDB
        await initBrowserDatabase();
        return BrowserDatabase;
      }
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  })();

  return initPromise;
}

async function createTables() {
  if (!db) throw new Error('Database not initialized');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS master_password (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      encrypted_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      encrypted_site TEXT NOT NULL,
      encrypted_username TEXT NOT NULL,
      encrypted_email TEXT NOT NULL,
      encrypted_password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES password_owners(id) ON DELETE CASCADE
    )
  `);

  // Sprint 4 migrations — add sync_id columns (idempotent: silently ignored if already present)
  try { await db.execute('ALTER TABLE password_owners ADD COLUMN sync_id TEXT'); } catch { /* already added */ }
  try { await db.execute('ALTER TABLE password_entries ADD COLUMN sync_id TEXT'); } catch { /* already added */ }

  // Extra fields migration — encrypted JSON blob for arbitrary key-value fields per entry
  try { await db.execute('ALTER TABLE password_entries ADD COLUMN encrypted_extra_fields TEXT'); } catch { /* already added */ }

  // Backfill sync_id for any rows that don't have one yet
  await db.execute(`UPDATE password_owners SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL`);
  await db.execute(`UPDATE password_entries SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync DATETIME,
      device_id TEXT NOT NULL,
      sync_version INTEGER DEFAULT 1
    )
  `);

  // Security question table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS security_question (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      question_id INTEGER NOT NULL,
      answer_hash TEXT NOT NULL,
      answer_salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Vault identity — stores the Ed25519 keypair that identifies this vault across devices.
  // vault_public_key is the "sync code" shown to users. The private key is AES-256-GCM
  // encrypted with a PBKDF2 key derived from the master password (all operations in Rust).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS vault_identity (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      vault_public_key TEXT NOT NULL,
      encrypted_secret TEXT NOT NULL,
      kdf_salt TEXT NOT NULL,
      aes_nonce TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Known sync peers — persists across restarts so the user doesn't need to re-pair devices.
  // node_id is the iroh NodeId (base32 string). label is an optional user-friendly name.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_peers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL UNIQUE,
      label TEXT,
      last_seen INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Revoked peers — connections from these NodeIds are rejected at the iroh layer.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS revoked_peers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL UNIQUE,
      revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getDatabase() {
  if (!initPromise) {
    await initDatabase();
  }
  
  const result = await initPromise;
  return result || BrowserDatabase;
}