import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface PasswordVaultDB extends DBSchema {
  master_password: {
    key: number;
    value: {
      id: number;
      password_hash: string;
      salt: string;
      created_at: string;
    };
  };
  password_owners: {
    key: number;
    value: {
      id?: number;
      name: string;
      encrypted_data: string;
      created_at: string;
      updated_at: string;
    };
    indexes: { 'by-name': string };
  };
  password_entries: {
    key: number;
    value: {
      id?: number;
      owner_id: number;
      encrypted_site: string;
      encrypted_username: string;
      encrypted_email: string;
      encrypted_password: string;
      created_at: string;
      updated_at: string;
    };
    indexes: { 'by-owner': number };
  };
  sync_metadata: {
    key: number;
    value: {
      id: number;
      last_sync: string | null;
      device_id: string;
      sync_version: number;
    };
  };
   security_question: {
    key: number;
    value: {
      id: number;
      question_id: number;
      answer_hash: string;
      answer_salt: string;
      created_at: string;
    };
  };
}

let db: IDBPDatabase<PasswordVaultDB> | null = null;

export async function initBrowserDatabase() {
  if (db) return db;

  db = await openDB<PasswordVaultDB>('password-vault', 2, {
    upgrade(database, _oldVersion, _newVersion) {
      // Create master_password store
      if (!database.objectStoreNames.contains('master_password')) {
        database.createObjectStore('master_password', { keyPath: 'id' });
      }

      // Create password_owners store
      if (!database.objectStoreNames.contains('password_owners')) {
        const ownerStore = database.createObjectStore('password_owners', {
          keyPath: 'id',
          autoIncrement: true,
        });
        ownerStore.createIndex('by-name', 'name', { unique: true });
      }

      // Create password_entries store
      if (!database.objectStoreNames.contains('password_entries')) {
        const entryStore = database.createObjectStore('password_entries', {
          keyPath: 'id',
          autoIncrement: true,
        });
        entryStore.createIndex('by-owner', 'owner_id');
      }

      // Create sync_metadata store
      if (!database.objectStoreNames.contains('sync_metadata')) {
        database.createObjectStore('sync_metadata', { keyPath: 'id' });
      }

       // Create security_question store
      if (!database.objectStoreNames.contains('security_question')) {
        database.createObjectStore('security_question', { keyPath: 'id' });
      }
    },
  });

  return db;
}

export class BrowserDatabase {
  static async execute(query: string, params?: any[]): Promise<void> {
    const db = await initBrowserDatabase();
    const queryLower = query.toLowerCase().trim();
    
    console.log('Execute:', query, params);

    // INSERT INTO master_password
    if (queryLower.includes('insert into master_password')) {
      await db.put('master_password', {
        id: 1,
        password_hash: params?.[0] as string,
        salt: params?.[1] as string,
        created_at: new Date().toISOString(),
      });
      return;
    }

    // INSERT INTO password_owners
    if (queryLower.includes('insert into password_owners')) {
      await db.add('password_owners', {
        name: params?.[0] as string,
        encrypted_data: params?.[1] as string,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return;
    }

    // INSERT INTO password_entries
    if (queryLower.includes('insert into password_entries')) {
      await db.add('password_entries', {
        owner_id: params?.[0] as number,
        encrypted_site: params?.[1] as string,
        encrypted_username: params?.[2] as string,
        encrypted_email: params?.[3] as string,
        encrypted_password: params?.[4] as string,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return;
    }

    // INSERT INTO security_question
    if (queryLower.includes('insert into security_question')) {
      await db.put('security_question', {
        id: 1,
        question_id: params?.[0] as number,
        answer_hash: params?.[1] as string,
        answer_salt: params?.[2] as string,
        created_at: new Date().toISOString(),
      });
      return;
    }

    // UPDATE password_owners
    if (queryLower.includes('update password_owners')) {
      if (queryLower.includes('where name')) {
        // Find by name first
        const name = params?.[params.length - 1] as string;
        const allOwners = await db.getAll('password_owners');
        const owner = allOwners.find(o => o.name === name);
        
        if (owner && owner.id) {
          await db.put('password_owners', {
            ...owner,
            encrypted_data: params?.[0] as string,
            updated_at: new Date().toISOString(),
          });
        }
      }
      return;
    }

    // UPDATE password_entries
if (queryLower.includes('update password_entries')) {
  const entryId = params?.[params.length - 1] as number;
  const entry = await db.get('password_entries', entryId);
  
  if (entry) {
    await db.put('password_entries', {
      ...entry,
      id: entryId,
      encrypted_site: params?.[0] as string,
      encrypted_username: params?.[1] as string,
      encrypted_email: params?.[2] as string,
      encrypted_password: params?.[3] as string,
      updated_at: new Date().toISOString(),
    });
  }
  return;
}

    // UPDATE sync_metadata
    if (queryLower.includes('update sync_metadata')) {
      const existing = await db.get('sync_metadata', 1);
      if (existing) {
        await db.put('sync_metadata', {
          ...existing,
          last_sync: new Date().toISOString(),
        });
      }
      return;
    }

     // UPDATE security_question
    if (queryLower.includes('update security_question')) {
      const existing = await db.get('security_question', 1);
      if (existing) {
        await db.put('security_question', {
          ...existing,
          question_id: params?.[0] as number,
          answer_hash: params?.[1] as string,
          answer_salt: params?.[2] as string,
        });
      }
      return;
    }

    // DELETE FROM password_owners
    if (queryLower.includes('delete from password_owners')) {
      const ownerId = params?.[0] as number;
      await db.delete('password_owners', ownerId);
      
      // Delete associated entries (CASCADE)
      const entries = await db.getAllFromIndex('password_entries', 'by-owner', ownerId);
      for (const entry of entries) {
        if (entry.id) {
          await db.delete('password_entries', entry.id);
        }
      }
      return;
    }

    // DELETE FROM password_entries
    if (queryLower.includes('delete from password_entries')) {
      const entryId = params?.[0] as number;
      await db.delete('password_entries', entryId);
      return;
    }

    // BEGIN TRANSACTION / COMMIT / ROLLBACK - IndexedDB handles these automatically
    if (queryLower.includes('begin transaction') || 
        queryLower.includes('commit') || 
        queryLower.includes('rollback')) {
      return;
    }

    // CREATE TABLE - Already handled in upgrade
    if (queryLower.includes('create table')) {
      return;
    }

    console.warn('Unhandled SQL query:', query);
  }

  static async select<T>(query: string, params?: any[]): Promise<T[]> {
    const db = await initBrowserDatabase();
    const queryLower = query.toLowerCase().trim();
    
    console.log('Select:', query, params);

    // SELECT FROM master_password
    if (queryLower.includes('from master_password')) {
      const result = await db.get('master_password', 1);
      return result ? [result as T] : [];
    }

    // SELECT FROM password_owners
    if (queryLower.includes('from password_owners')) {
      if (queryLower.includes('where name')) {
        // Find by name
        const name = params?.[0] as string;
        const allOwners = await db.getAll('password_owners');
        const owner = allOwners.find(o => o.name === name);
        return owner ? [owner as T] : [];
      }
      
      // Get all owners
      const results = await db.getAll('password_owners');
      return results as T[];
    }

    // SELECT FROM password_entries
    if (queryLower.includes('from password_entries')) {
      if (queryLower.includes('where owner_id') && params && params.length > 0) {
        // Get entries for specific owner
        const ownerId = params[0] as number;
        const results = await db.getAllFromIndex('password_entries', 'by-owner', ownerId);
        return results as T[];
      }
      
      if (queryLower.includes('where id') && params && params.length > 0) {
        // Get specific entry
        const entryId = params[0] as number;
        const result = await db.get('password_entries', entryId);
        return result ? [result as T] : [];
      }
      
      // Get all entries
      const results = await db.getAll('password_entries');
      return results as T[];
    }

    // SELECT FROM sync_metadata
    if (queryLower.includes('from sync_metadata')) {
      const result = await db.get('sync_metadata', 1);
      return result ? [result as T] : [];
    }

     // SELECT FROM security_question
    if (queryLower.includes('from security_question')) {
      const result = await db.get('security_question', 1);
      return result ? [result as T] : [];
    }

    console.warn('Unhandled SELECT query:', query);
    return [];
  }
}