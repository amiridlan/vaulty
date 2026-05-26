import { getDatabase } from './database';
import { isDesktopApp } from '../utils/tauri';

export interface SyncPeerRow {
  id: number;
  node_id: string;
  label: string | null;
  last_seen: number | null;
  created_at: string;
}

export interface RevokedPeerRow {
  id: number;
  node_id: string;
  revoked_at: string;
}

export async function getKnownPeers(): Promise<SyncPeerRow[]> {
  if (!isDesktopApp()) return [];
  const db = await getDatabase();
  return db.select('SELECT * FROM sync_peers ORDER BY last_seen DESC') as Promise<SyncPeerRow[]>;
}

export async function upsertPeer(nodeId: string, label?: string): Promise<void> {
  if (!isDesktopApp()) return;
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);
  await db.execute(
    `INSERT INTO sync_peers (node_id, label, last_seen)
     VALUES (?, ?, ?)
     ON CONFLICT(node_id) DO UPDATE SET last_seen = excluded.last_seen`,
    [nodeId, label ?? null, now],
  );
}

export async function updatePeerLastSeen(nodeId: string): Promise<void> {
  if (!isDesktopApp()) return;
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);
  await db.execute('UPDATE sync_peers SET last_seen = ? WHERE node_id = ?', [now, nodeId]);
}

export async function removePeer(nodeId: string): Promise<void> {
  if (!isDesktopApp()) return;
  const db = await getDatabase();
  await db.execute('DELETE FROM sync_peers WHERE node_id = ?', [nodeId]);
}

export async function setPeerLabel(nodeId: string, label: string): Promise<void> {
  if (!isDesktopApp()) return;
  const db = await getDatabase();
  await db.execute('UPDATE sync_peers SET label = ? WHERE node_id = ?', [label, nodeId]);
}

// ── Revocation ────────────────────────────────────────────────────────────────

export async function getRevokedPeers(): Promise<RevokedPeerRow[]> {
  if (!isDesktopApp()) return [];
  const db = await getDatabase();
  return db.select('SELECT * FROM revoked_peers ORDER BY revoked_at DESC') as Promise<RevokedPeerRow[]>;
}

export async function addRevokedPeer(nodeId: string): Promise<void> {
  if (!isDesktopApp()) return;
  const db = await getDatabase();
  await db.execute(
    'INSERT OR IGNORE INTO revoked_peers (node_id) VALUES (?)',
    [nodeId],
  );
  // Also remove from known peers
  await db.execute('DELETE FROM sync_peers WHERE node_id = ?', [nodeId]);
}

export async function removeRevokedPeer(nodeId: string): Promise<void> {
  if (!isDesktopApp()) return;
  const db = await getDatabase();
  await db.execute('DELETE FROM revoked_peers WHERE node_id = ?', [nodeId]);
}

export async function isRevoked(nodeId: string): Promise<boolean> {
  if (!isDesktopApp()) return false;
  const db = await getDatabase();
  const rows = await db.select(
    'SELECT id FROM revoked_peers WHERE node_id = ?',
    [nodeId],
  ) as { id: number }[];
  return rows.length > 0;
}
