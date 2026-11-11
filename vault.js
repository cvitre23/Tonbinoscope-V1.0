const encoder = new TextEncoder();
const decoder = new TextDecoder();
const random = length => crypto.getRandomValues(new Uint8Array(length));
const recordKey = 'directory';

export function schoolYear(date = new Date()) {
  return date.getFullYear() - (date.getMonth() < 7 ? 1 : 0);
}

export function openVault() {
  return new Promise((resolve, reject) => {
    const name = 'trombinoscope-demo:' + new URL('./', import.meta.url).pathname;
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vault');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function update(db, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    const store = tx.objectStore('vault');
    const request = store.get(recordKey);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error('Transaction interrompue.'));
    request.onsuccess = () => { result = operation(store, request.result); };
  });
}

export function readCurrent(db, year) {
  return update(db, (store, record) => {
    if (record && record.year < year) {
      store.delete(recordKey);
      return { record: undefined, expired: true };
    }
    return { record, expired: false };
  });
}

export function replaceRecord(db, expectedRevision, nextRecord) {
  return update(db, (store, record) => {
    if (record?.revision !== expectedRevision) return false;
    if (nextRecord) store.put(nextRecord, recordKey);
    else store.delete(recordKey);
    return true;
  });
}

export function newSalt() {
  return random(16);
}

export async function deriveKey(password, salt, extractable = false) {
  const material = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']
  );
}

export async function encryptDirectory(data, key, salt, year, passkey) {
  const iv = random(12);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(String(year)) },
    key, encoder.encode(JSON.stringify(data))
  );
  return { revision: crypto.randomUUID(), year, salt, iv, cipher, ...(passkey && { passkey }) };
}

export async function decryptDirectory(record, key) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: record.iv, additionalData: encoder.encode(String(record.year)) },
    key, record.cipher
  );
  return JSON.parse(decoder.decode(plain));
}

export function nextPurge(date = new Date()) {
  return new Date(schoolYear(date) + 1, 7, 1);
}

// Test uniquement : vieillit l’enregistrement d’un an sans le déchiffrer.
// Au prochain readCurrent, il est supprimé comme lors d’un vrai 1er août.
export function ageRecord(db, expectedRevision) {
  return update(db, (store, record) => {
    if (!record || record.revision !== expectedRevision) return false;
    store.put({ ...record, year: record.year - 1 }, recordKey);
    return true;
  });
}
