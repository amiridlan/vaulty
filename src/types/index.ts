export interface MasterPassword {
  id: number;
  password_hash: string;
  salt: string;
  created_at: string;
}

export interface PasswordOwner {
  id: number;
  name: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export interface PasswordEntry {
  id: number;
  owner_id: number;
  encrypted_site: string;
  encrypted_username: string;
  encrypted_email: string;
  encrypted_password: string;
  created_at: string;
  updated_at: string;
}

export interface DecryptedPasswordEntry {
  id: number;
  owner_id: number;
  site: string;
  username: string;
  email: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface SyncMetadata {
  id: number;
  last_sync: string | null;
  device_id: string;
  sync_version: number;
}

export interface SecurityQuestionData {
  id: number;
  question_id: number;
  answer_hash: string;
  answer_salt: string;
  created_at: string;
}