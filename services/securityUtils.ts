
const DB_NAME = 'harmony-security';
const STORE_NAME = 'keys';
const KEY_ID = 'master-session-key';

async function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPersistentKey(): Promise<CryptoKey> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(KEY_ID);
    
    request.onsuccess = async () => {
      if (request.result) {
        resolve(request.result);
      } else {
        // Create new key and store it
        const newKey = await window.crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
        const writeTx = db.transaction(STORE_NAME, 'readwrite');
        writeTx.objectStore(STORE_NAME).put(newKey, KEY_ID);
        writeTx.oncomplete = () => resolve(newKey);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function createSessionKey(): Promise<CryptoKey> {
  // Alias to getPersistentKey for backward compatibility in this refactor
  return getPersistentKey();
}

export async function encryptData(text: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedBase64: string, key: CryptoKey): Promise<string> {
  const binary = atob(encryptedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Simple PII Redaction pattern
export function redactPII(text: string): string {
  // Redact Emails
  let redacted = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
  // Redact simple phone numbers (US format approx)
  redacted = redacted.replace(/(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[PHONE_REDACTED]');
  return redacted;
}
