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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync DATETIME,
      device_id TEXT NOT NULL,
      sync_version INTEGER DEFAULT 1
    )
  `);

   // Master password table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS master_password (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
}

export async function getDatabase() {
  if (!initPromise) {
    await initDatabase();
  }
  
  const result = await initPromise;
  return result || BrowserDatabase;
}