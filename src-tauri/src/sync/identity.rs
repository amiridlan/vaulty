use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use ed25519_dalek::{SigningKey, VerifyingKey};
use pbkdf2::pbkdf2_hmac;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

/// All fields stored in the vault_identity SQLite row.
/// The private key bytes are AES-256-GCM encrypted with a key derived from
/// the master password via PBKDF2-SHA256 (100k iterations), matching the
/// same derivation parameters used by the TypeScript EncryptionService.
#[derive(Debug, Serialize, Deserialize)]
pub struct VaultKeypairData {
    /// bs58-encoded Ed25519 public key — this is the "sync code" shown to the user
    pub vault_public_key: String,
    /// hex-encoded AES-256-GCM ciphertext of the 32-byte Ed25519 private key seed
    pub encrypted_secret: String,
    /// hex-encoded 32-byte PBKDF2 salt
    pub kdf_salt: String,
    /// hex-encoded 12-byte AES-GCM nonce
    pub aes_nonce: String,
}

/// Generate a new Ed25519 vault keypair and encrypt the private key with the
/// master password. Returns all data needed for the frontend to persist in SQLite.
pub fn generate_and_encrypt(master_password: &str) -> Result<VaultKeypairData, String> {
    let mut rng = OsRng;

    // Generate Ed25519 keypair
    let signing_key = SigningKey::generate(&mut rng);
    let verifying_key: VerifyingKey = signing_key.verifying_key();

    // Encode public key as bs58 (this is what users share as the "sync code")
    let vault_public_key = bs58::encode(verifying_key.as_bytes()).into_string();

    // Derive AES-256 encryption key from master password via PBKDF2-SHA256
    let mut kdf_salt = [0u8; 32];
    rng.fill_bytes(&mut kdf_salt);
    let aes_key = derive_key(master_password, &kdf_salt);

    // Encrypt the 32-byte private key seed with AES-256-GCM
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&aes_key));
    let mut nonce_bytes = [0u8; 12];
    rng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted = cipher
        .encrypt(nonce, signing_key.as_bytes().as_ref())
        .map_err(|e| format!("Failed to encrypt vault keypair: {e}"))?;

    Ok(VaultKeypairData {
        vault_public_key,
        encrypted_secret: hex::encode(encrypted),
        kdf_salt: hex::encode(kdf_salt),
        aes_nonce: hex::encode(nonce_bytes),
    })
}

/// Verify the master password against the stored encrypted vault keypair.
/// Returns the vault public key on success — confirms the password is correct
/// and the stored keypair is intact, without exposing the private key.
pub fn verify_and_get_public_key(
    master_password: &str,
    encrypted_secret: &str,
    kdf_salt: &str,
    aes_nonce: &str,
) -> Result<String, String> {
    let signing_key = decrypt_signing_key(master_password, encrypted_secret, kdf_salt, aes_nonce)?;
    let verifying_key: VerifyingKey = signing_key.verifying_key();
    Ok(bs58::encode(verifying_key.as_bytes()).into_string())
}

/// Decrypt the signing key — used internally by sync operations that need to sign data.
/// Never returned directly to the frontend.
pub fn decrypt_signing_key(
    master_password: &str,
    encrypted_secret: &str,
    kdf_salt: &str,
    aes_nonce: &str,
) -> Result<SigningKey, String> {
    let salt = hex::decode(kdf_salt).map_err(|e| format!("Invalid kdf_salt: {e}"))?;
    let nonce_bytes = hex::decode(aes_nonce).map_err(|e| format!("Invalid aes_nonce: {e}"))?;
    let ciphertext =
        hex::decode(encrypted_secret).map_err(|e| format!("Invalid encrypted_secret: {e}"))?;

    let aes_key = derive_key(master_password, &salt);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&aes_key));
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "Incorrect master password or corrupted vault identity".to_string())?;

    let key_bytes: [u8; 32] = plaintext
        .try_into()
        .map_err(|_| "Vault keypair has unexpected length — data may be corrupted".to_string())?;

    Ok(SigningKey::from_bytes(&key_bytes))
}

fn derive_key(master_password: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(master_password.as_bytes(), salt, 100_000, &mut key);
    key
}
