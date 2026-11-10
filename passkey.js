const random = size => crypto.getRandomValues(new Uint8Array(size));

function prfResult(credential) {
  return credential?.getClientExtensionResults().prf?.results?.first;
}

export async function createPasskey(signal) {
  const salt = random(32);
  const credential = await navigator.credentials.create({ signal, publicKey: {
    challenge: random(32),
    rp: { name: 'Trombinoscope de test' },
    user: { id: random(32), name: 'Espace de test', displayName: 'Trombinoscope de test' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required'
    },
    timeout: 60000,
    extensions: { prf: {} }
  } });
  if (!credential?.getClientExtensionResults().prf?.enabled) {
    throw new Error('Cette clé d’accès ne fournit pas le secret nécessaire au chiffrement. Utilise le mot de passe.');
  }
  return { id: credential.id, rawId: credential.rawId, salt };
}

export async function readPasskey(passkey, signal) {
  const credential = await navigator.credentials.get({ signal, publicKey: {
    challenge: random(32),
    allowCredentials: [{ type: 'public-key', id: passkey.rawId, transports: ['internal'] }],
    userVerification: 'required',
    timeout: 60000,
    extensions: { prf: { eval: { first: passkey.salt } } }
  } });
  const result = prfResult(credential);
  if (credential?.id !== passkey.id || !result) {
    throw new Error('Cette clé d’accès ne peut pas ouvrir le coffre. Utilise le mot de passe.');
  }
  return result;
}

function wrappingParams(passkey, record) {
  const scope = new URL('./', import.meta.url).href;
  return { name: 'AES-GCM', iv: passkey.iv, additionalData: new TextEncoder().encode(
    JSON.stringify(['trombinoscope-passkey-v1', scope, record.year, passkey.id, [...record.salt]])
  ) };
}

async function wrappingKey(secret, usage) {
  try {
    if (secret.byteLength !== 32) throw new Error('Clé d’accès incompatible.');
    return await crypto.subtle.importKey('raw', secret, 'AES-GCM', false, [usage]);
  } finally {
    new Uint8Array(secret).fill(0);
  }
}

export async function protectKey(credential, secret, record, key) {
  const { id, rawId, salt } = credential;
  const passkey = { id, rawId, salt, iv: random(12) };
  const wrapper = await wrappingKey(secret, 'wrapKey');
  const wrapped = await crypto.subtle.wrapKey('raw', key, wrapper, wrappingParams(passkey, record));
  return { ...passkey, wrapped };
}

export async function recoverKey(record, secret) {
  const passkey = record.passkey;
  const wrapper = await wrappingKey(secret, 'unwrapKey');
  return crypto.subtle.unwrapKey('raw', passkey.wrapped, wrapper, wrappingParams(passkey, record),
    'AES-GCM', false, ['encrypt', 'decrypt']);
}
