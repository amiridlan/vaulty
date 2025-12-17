import CryptoJS from 'crypto-js';

export class EncryptionService {
  private static encryptionKey: string | null = null;

  // Generate a random salt
  static generateSalt(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.bytesToHex(array);
  }

  // Convert bytes to hex string
  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Convert hex string to bytes
  static hexToBytes(hex: string): Uint8Array {
    const length = hex.length / 2;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // Hash master password using PBKDF2 with SHA-256
  static async hashMasterPassword(password: string, salt: string): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const saltBytes = this.hexToBytes(salt);
    
    // Create a new Uint8Array with explicit ArrayBuffer to satisfy TypeScript
    const saltBuffer = new Uint8Array(saltBytes).buffer as ArrayBuffer;
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256 // 256 bits = 32 bytes
    );

    return this.bytesToHex(new Uint8Array(derivedBits));
  }

  // Derive encryption key from master password
  static async deriveEncryptionKey(password: string, salt: string): Promise<string> {
    // Use the same method as hashMasterPassword for consistency
    return await this.hashMasterPassword(password, salt);
  }

  // Set the encryption key for the session
  static setEncryptionKey(key: string) {
    this.encryptionKey = key;
  }

  // Get the current encryption key
  static getEncryptionKey(): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set. Please login first.');
    }
    return this.encryptionKey;
  }

  // Clear encryption key (on logout)
  static clearEncryptionKey() {
    this.encryptionKey = null;
  }

  // Encrypt data using AES-256
  static encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const encrypted = CryptoJS.AES.encrypt(plaintext, key);
    return encrypted.toString();
  }

  // Decrypt data using AES-256
  static decrypt(ciphertext: string): string {
    const key = this.getEncryptionKey();
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key);
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  // Encrypt an object
  static encryptObject(obj: any): string {
    return this.encrypt(JSON.stringify(obj));
  }

  // Decrypt to object
  static decryptObject<T>(ciphertext: string): T {
    const decrypted = this.decrypt(ciphertext);
    return JSON.parse(decrypted);
  }
}