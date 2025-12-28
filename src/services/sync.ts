import { getDatabase } from './database';
import { EncryptionService } from './encryption';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { isDesktopApp } from '../utils/tauri';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';

export interface SyncDevice {
  id: string;
  name: string;
  lastSeen: number;
  ipAddress: string;
}

export interface SyncData {
  owners: any[];
  entries: any[];
  timestamp: number;
  deviceId: string;
}

export class SyncService {
  private static deviceId: string | null = null;

  // Generate or retrieve device ID
  static getDeviceId(): string {
    if (this.deviceId) return this.deviceId;

    // Try to get from localStorage
    const stored = localStorage.getItem('device_id');
    if (stored) {
      this.deviceId = stored;
      return stored;
    }

    // Generate new device ID
    const newId = this.generateDeviceId();
    localStorage.setItem('device_id', newId);
    this.deviceId = newId;
    return newId;
  }

  private static generateDeviceId(): string {
    return 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Initialize sync metadata in database
  static async initializeSyncMetadata(): Promise<void> {
    const db = await getDatabase();
    const deviceId = this.getDeviceId();

    // Check if metadata exists
    const existing = await db.select(
      'SELECT * FROM sync_metadata WHERE id = 1'
    );

    if (existing.length === 0) {
      await db.execute(
        'INSERT INTO sync_metadata (id, device_id, sync_version) VALUES (1, ?, 1)',
        [deviceId]
      );
    }
  }

  // Export all data for sync
  static async exportSyncData(): Promise<SyncData> {
    const db = await getDatabase();

    // Get all password owners
    const owners = await db.select('SELECT * FROM password_owners');

    // Get all password entries
    const entries = await db.select('SELECT * FROM password_entries');

    return {
      owners,
      entries,
      timestamp: Date.now(),
      deviceId: this.getDeviceId(),
    };
  }

  // Import sync data (merge with existing)
  static async importSyncData(syncData: SyncData): Promise<void> {
    const db = await getDatabase();

    try {
      // Start transaction (SQLite supports this)
      await db.execute('BEGIN TRANSACTION');

      // Merge owners
      for (const owner of syncData.owners) {
        // Check if owner exists
        const existing = await db.select(
          'SELECT * FROM password_owners WHERE name = ?',
          [owner.name]
        );

        if (existing.length === 0) {
          // Insert new owner
          await db.execute(
            `INSERT INTO password_owners (name, encrypted_data, created_at, updated_at) 
             VALUES (?, ?, ?, ?)`,
            [owner.name, owner.encrypted_data, owner.created_at, owner.updated_at]
          );
        } else {
          // Update if remote is newer
          const localOwner = existing[0] as any;
          if (new Date(owner.updated_at) > new Date(localOwner.updated_at)) {
            await db.execute(
              `UPDATE password_owners 
               SET encrypted_data = ?, updated_at = ? 
               WHERE name = ?`,
              [owner.encrypted_data, owner.updated_at, owner.name]
            );
          }
        }
      }

      // Get owner ID mapping (name to local ID)
      const ownerMapping = new Map<number, number>();
      for (const remoteOwner of syncData.owners) {
        const localOwner = await db.select(
          'SELECT id FROM password_owners WHERE name = ?',
          [remoteOwner.name]
        );
        if (localOwner.length > 0) {
          ownerMapping.set(remoteOwner.id, (localOwner[0] as any).id);
        }
      }

      // Merge entries
      for (const entry of syncData.entries) {
        const localOwnerId = ownerMapping.get(entry.owner_id);
        if (!localOwnerId) continue;

        // Check if entry exists (by site and owner)
        const existing = await db.select(
          `SELECT * FROM password_entries 
           WHERE owner_id = ? AND encrypted_site = ?`,
          [localOwnerId, entry.encrypted_site]
        );

        if (existing.length === 0) {
          // Insert new entry
          await db.execute(
            `INSERT INTO password_entries 
             (owner_id, encrypted_site, encrypted_username, encrypted_email, encrypted_password, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              localOwnerId,
              entry.encrypted_site,
              entry.encrypted_username,
              entry.encrypted_email,
              entry.encrypted_password,
              entry.created_at,
              entry.updated_at,
            ]
          );
        } else {
          // Update if remote is newer
          const localEntry = existing[0] as any;
          if (new Date(entry.updated_at) > new Date(localEntry.updated_at)) {
            await db.execute(
              `UPDATE password_entries 
               SET encrypted_username = ?, encrypted_email = ?, encrypted_password = ?, updated_at = ? 
               WHERE id = ?`,
              [
                entry.encrypted_username,
                entry.encrypted_email,
                entry.encrypted_password,
                entry.updated_at,
                localEntry.id,
              ]
            );
          }
        }
      }

      // Update sync metadata
      await db.execute(
        'UPDATE sync_metadata SET last_sync = CURRENT_TIMESTAMP WHERE id = 1'
      );

      // Commit transaction
      await db.execute('COMMIT');
    } catch (error) {
      // Rollback on error
      await db.execute('ROLLBACK');
      throw error;
    }
  }

  // Encrypt sync data for transfer
  static encryptSyncData(syncData: SyncData): string {
    return EncryptionService.encryptObject(syncData);
  }

  // Decrypt received sync data
  static decryptSyncData(encryptedData: string): SyncData {
    return EncryptionService.decryptObject<SyncData>(encryptedData);
  }

  // Save sync data to file for manual transfer
  static async saveSyncFile(): Promise<string> {
    try {
      console.log('1. Exporting sync data...');
      const syncData = await this.exportSyncData();
      console.log('2. Sync data exported:', syncData);
      
      console.log('3. Encrypting data...');
      const encrypted = this.encryptSyncData(syncData);
      console.log('4. Data encrypted, length:', encrypted.length);
      
      if (isDesktopApp()) {
        console.log('5. Running in desktop mode, showing save dialog...');
        // Desktop: Use native file dialog
        try {
          const filePath = await save({
            defaultPath: `password-vault-sync-${Date.now()}.pvs`,
            filters: [{
              name: 'Password Vault Sync',
              extensions: ['pvs']
            }]
          });

          console.log('6. File path selected:', filePath);

          if (!filePath) {
            console.log('7. User cancelled file dialog');
            throw new Error('Save cancelled - no file path selected');
          }

          console.log('8. Writing file to:', filePath);
          await writeTextFile(filePath, encrypted);
          console.log('9. File written successfully');
          
          return filePath;
        } catch (error: any) {
          console.error('Desktop save error:', error);
          throw new Error(`Desktop save failed: ${error.message || 'Unknown error'}`);
        }
      } else {
        console.log('5. Running in browser mode, triggering download...');
        // Browser: Use download
        try {
          const blob = new Blob([encrypted], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          const filename = `password-vault-sync-${Date.now()}.pvs`;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          
          // Small delay before cleanup
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);

          console.log('6. Browser download triggered:', filename);
          return `Downloaded to: ${filename}`;
        } catch (error: any) {
          console.error('Browser download error:', error);
          throw new Error(`Browser download failed: ${error.message || 'Unknown error'}`);
        }
      }
    } catch (error: any) {
      console.error('Save sync file error:', error);
      throw new Error(error.message || 'Failed to save sync file');
    }
  }

  // Load sync data from file
  static async loadSyncFile(file?: File): Promise<void> {
    if (isDesktopApp() && !file) {
      // Desktop: Use native file picker
      try {
        const selected = await open({
          multiple: false,
          filters: [{
            name: 'Password Vault Sync',
            extensions: ['pvs']
          }]
        });

        if (!selected) {
          throw new Error('No file selected');
        }

        const filePath = Array.isArray(selected) ? selected[0] : selected;
        const encrypted = await readTextFile(filePath);
        const syncData = this.decryptSyncData(encrypted);
        await this.importSyncData(syncData);
      } catch (error: any) {
        console.error('Desktop load error:', error);
        throw new Error(`Failed to load sync file: ${error.message || 'Unknown error'}`);
      }
    } else if (file) {
      // Browser: Use provided file
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const encrypted = e.target?.result as string;
            const syncData = this.decryptSyncData(encrypted);
            await this.importSyncData(syncData);
            resolve();
          } catch (error: any) {
            console.error('File read error:', error);
            reject(new Error(`Failed to process file: ${error.message || 'Unknown error'}`));
          }
        };
        
        reader.onerror = () => {
          console.error('File reader error:', reader.error);
          reject(new Error('Failed to read file'));
        };
        
        reader.readAsText(file);
      });
    } else {
      throw new Error('No file provided');
    }
  }

  // Get last sync time
  static async getLastSyncTime(): Promise<Date | null> {
    const db = await getDatabase();
    const result = await db.select(
      'SELECT last_sync FROM sync_metadata WHERE id = 1'
    );

    if (result.length > 0 && (result[0] as any).last_sync) {
      return new Date((result[0] as any).last_sync);
    }

    return null;
  }
}