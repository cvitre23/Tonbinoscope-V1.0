import {
  schoolYear, openVault, readCurrent, replaceRecord, newSalt,
  deriveKey, encryptDirectory, decryptDirectory, nextPurge, ageRecord
} from './vault.js';
import { createPasskey, readPasskey, protectKey, recoverKey } from './passkey.js';

const el = id => document.getElementById(id);
const say = message => { el('message').textContent = message; };
const avatars = ['🦊', '🐼', '🐸', '🦉', '🐱', '🐻', '🐰', '🐨'];
let db;
let record;
let directory;
let key;
let activeClass;
let session = 0;
let busy = false;
let editingStudent;
let draftPhoto;
let photoSelection = 0;
let passkeySetup;
let passkeyRequest;
const idleMinutes = 5;
const pickerGraceMs = 2 * 60 * 1000;
let idleTimer;
let pickerOpenedAt = 0;
let hiddenAt = 0;
const supportsPasskeys = !!(window.PublicKeyCredential && navigator.credentials);

function demoDirectory() {
  return [
    ['CE1 des Étoiles', ['Alba', 'Milo', 'Nino', 'Lila']],
    ['CM2 des Nuages', ['Olympe', 'Noé', 'Iris', 'Sacha']]
  ].map(([name, firstNames], group) => ({
    id: crypto.randomUUID(), name,
    students: firstNames.map((name, index) => ({
      id: crypto.randomUUID(), name, avatar: index + group * 4
    }))
  }));
}

function showLock() {
  el('locked').hidden = false;
  el('unlocked').hidden = true;
  el('unlock').hidden = !db;
  el('reset').hidden = !record;
  el('unlock-passkey').hidden = !record?.passkey || !supportsPasskeys;
  el('lock-title').textContent = record ? 'Trombinoscope verrouillé' : 'Créer un espace de test';
  el('lock-help').textContent = record
    ? 'Saisis ton mot de passe de test pour afficher les classes.'
    : 'Choisis au moins 8 caractères. Deux classes fictives seront ajoutées.';
  el('unlock-button').textContent = record ? 'Déverrouiller' : 'Créer l’espace de test';
  el('password').minLength = record ? 1 : 8;
  el('password').autocomplete = record ? 'current-password' : 'new-password';
}

function lock() {
  session++;
  clearTimeout(idleTimer);
  pickerOpenedAt = 0;
  passkeyRequest?.abort();
  clearPasskeySetup();
  directory = key = activeClass = undefined;
  for (const id of ['unlock', 'add-class']) el(id).reset();
  resetStudentForm();
  for (const id of ['students', 'classes']) el(id).replaceChildren();
  for (const id of ['class-title', 'empty']) el(id).textContent = '';
  if (db) showLock();
  say('');
}

function showPhoto(photo) {
  const preview = el('photo-preview');
  if (photo) preview.src = photo;
  else preview.removeAttribute('src');
  preview.hidden = !photo;
  el('photo-frame').hidden = !photo;
  el('remove-photo').hidden = !photo;
}

function fillClassSelect(select, selected) {
  select.replaceChildren(...(directory || []).map(group => new Option(group.name, group.id)));
  if (selected) select.value = selected;
}

function resetStudentForm(student) {
  photoSelection++;
  editingStudent = student?.id;
  draftPhoto = student?.photo;
  el('add-student').reset();
  el('first-name').value = student?.name || '';
  fillClassSelect(el('student-class'), activeClass);
  el('student-form-title').textContent = student ? 'Modifier la fiche' : 'Ajouter une fiche fictive';
  el('save-student').textContent = student ? 'Enregistrer la fiche' : 'Ajouter la fiche';
  el('save-student').disabled = false;
  el('cancel-edit').hidden = !student;
  el('photo-status').textContent = '';
  showPhoto(draftPhoto);
}

async function refreshRecord() {
  const current = await readCurrent(db, schoolYear());
  record = current.record;
  if (current.expired) {
    lock();
    say('Les données de l’année précédente ont été effacées.');
  }
  return current.expired;
}

function showDirectory() {
  el('locked').hidden = true;
  el('unlocked').hidden = false;
  el('passkey-panel').hidden = !supportsPasskeys;
  el('prepare-passkey').textContent = record.passkey ? 'Désactiver la clé d’accès' : 'Continuer';
  const current = directory.find(group => group.id === activeClass) || directory[0];
  activeClass = current?.id;
  el('classes').replaceChildren(...directory.map(group => new Option(group.name, group.id)));
  if (current) el('classes').value = current.id;
  el('classes').disabled = !current;
  el('remove-class').hidden = !current;
  el('rename-class').hidden = !current;
  el('rename-class-name').value = current?.name || '';
  if (!editingStudent) fillClassSelect(el('student-class'), current?.id);
  el('idle-minutes').textContent = idleMinutes;
  el('purge-date').textContent = '1er août ' + nextPurge().getFullYear();
  armIdleLock();
  el('student-panel').hidden = !current;
  el('class-title').textContent = current?.name || '';
  el('empty').textContent = !current ? 'Ajoute une classe pour commencer.'
    : current.students.length ? '' : 'Cette classe ne contient aucune fiche.';
  el('students').replaceChildren(...(current?.students || []).map(student => {
    const card = document.createElement('li');
    card.className = 'card';
    const portrait = document.createElement('span');
    if (student.photo) {
      // Filigrane affiché par-dessus la photo : toute capture d’écran le contient.
      portrait.className = 'portrait round';
      const image = document.createElement('img');
      image.src = student.photo;
      image.alt = '';
      const mark = document.createElement('span');
      mark.className = 'watermark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = 'CONFIDENTIEL';
      portrait.append(image, mark);
    } else {
      portrait.className = 'avatar';
      portrait.setAttribute('aria-hidden', 'true');
      portrait.textContent = avatars[student.avatar];
    }
    const name = document.createElement('p');
    name.textContent = student.name;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary';
    edit.textContent = 'Modifier';
    edit.setAttribute('aria-label', 'Modifier la fiche de ' + student.name);
    edit.addEventListener('click', () => {
      if (busy) return;
      resetStudentForm(student);
      el('first-name').focus();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'plain';
    remove.textContent = 'Supprimer';
    remove.setAttribute('aria-label', 'Supprimer la fiche de ' + student.name);
    remove.addEventListener('click', () => run(async token => {
      if (!confirm('Supprimer cette fiche fictive ?')) return;
      const next = directory.map(group => group.id === current.id
        ? { ...group, students: group.students.filter(item => item.id !== student.id) }
        : group);
      if (await save(next, token, current.id, 'Fiche supprimée.') && editingStudent === student.id) {
        resetStudentForm();
      }
    }));
    card.append(portrait, name, edit, remove);
    return card;
  }));
}

async function run(operation) {
  if (busy) return;
  busy = true;
  const token = session;
  try {
    await operation(token);
  } catch (error) {
    if (token === session) say(error.message || 'L’action a échoué.');
  } finally {
    busy = false;
  }
}

async function save(next, token, selected, message) {
  if (token !== session || !key) return false;
  const previous = record;
  if (previous.year < schoolYear()) {
    await refreshRecord();
    return false;
  }
  const candidate = await encryptDirectory(next, key, previous.salt, previous.year, previous.passkey);
  if (token !== session) return false;
  let replaced;
  try {
    replaced = await replaceRecord(db, previous.revision, candidate);
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      throw new Error('Espace de stockage insuffisant sur l’iPad. Rien n’a été modifié.');
    }
    throw error;
  }
  if (!replaced) {
    lock();
    await refreshRecord();
    showLock();
    say('Les données ont changé dans une autre fenêtre. Ouvre de nouveau l’espace de test.');
    return false;
  }
  if (token !== session) return false;
  record = candidate;
  directory = next;
  if (passkeySetup) clearPasskeySetup();
  if (activeClass !== selected) resetStudentForm();
  activeClass = selected;
  showDirectory();
  say(message);
  return true;
}

async function unlock(token, password) {
  if (await refreshRecord() || token !== session) return;
  showLock();
  const previous = record;
  if (!previous && password.length < 8) throw new Error('Choisis au moins 8 caractères.');
  const salt = previous?.salt || newSalt();
  const nextKey = await deriveKey(password, salt);
  if (token !== session) return;
  let next;
  if (previous) {
    try {
      next = await decryptDirectory(previous, nextKey);
    } catch {
      throw new Error('Mot de passe incorrect ou données illisibles.');
    }
    const latest = await readCurrent(db, schoolYear());
    if (token !== session) return;
    if (latest.record?.revision !== previous.revision) {
      record = latest.record;
      showLock();
      say(latest.expired ? 'Les données de l’année précédente ont été effacées.'
        : 'Les données ont changé. Réessaie.');
      return;
    }
  } else {
    next = demoDirectory();
    const candidate = await encryptDirectory(next, nextKey, salt, schoolYear());
    if (token !== session) return;
    if (!await replaceRecord(db, undefined, candidate)) {
      await refreshRecord();
      if (token === session) {
        showLock();
        say('Un espace de test existe déjà. Déverrouille-le.');
      }
      return;
    }
    if (token !== session) return;
    record = candidate;
    navigator.storage?.persist?.().catch(() => {});
  }
  key = nextKey;
  directory = next;
  showDirectory();
  el('directory-title').focus();
}

function clearPasskeySetup() {
  passkeySetup = undefined;
  el('passkey-setup').reset();
  el('passkey-setup').hidden = false;
  el('confirm-passkey').hidden = true;
  el('confirm-passkey').textContent = 'Créer une clé d’accès';
  el('cancel-passkey').hidden = true;
  el('passkey-status').textContent = '';
}

async function requestPasskey(operation) {
  const controller = new AbortController();
  passkeyRequest = controller;
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
      throw new Error('Vérification annulée ou indisponible. Le mot de passe reste utilisable.');
    }
    throw error;
  } finally {
    passkeyRequest = undefined;
  }
}

async function updatePasskey(previous, passkey, token) {
  if (token !== session) return;
  if (previous.year < schoolYear()) {
    await refreshRecord();
    return;
  }
  const { passkey: oldPasskey, ...fields } = previous;
  const candidate = { ...fields, revision: crypto.randomUUID(), ...(passkey && { passkey }) };
  if (!await replaceRecord(db, previous.revision, candidate)) {
    if (token !== session) return;
    lock();
    await refreshRecord();
    showLock();
    say('Les données ont changé. Déverrouille de nouveau le Trombinoscope.');
    return;
  }
  if (token !== session) return;
  record = candidate;
  clearPasskeySetup();
  showDirectory();
  say('');
  el('passkey-status').textContent = passkey ? 'Clé d’accès activée.' : 'Clé d’accès désactivée dans le Trombinoscope.';
}

el('passkey-setup').addEventListener('submit', event => {
  event.preventDefault();
  if (busy || !key) return;
  const password = el('passkey-password').value;
  el('passkey-password').value = '';
  run(async token => {
    const previous = record;
    const checkedKey = await deriveKey(password, previous.salt, !previous.passkey);
    if (token !== session) return;
    try {
      await decryptDirectory(previous, checkedKey);
    } catch {
      throw new Error('Mot de passe incorrect ou données illisibles.');
    }
    if (token !== session) return;
    if (previous.passkey) {
      await updatePasskey(previous, undefined, token);
      return;
    }
    passkeySetup = { key: checkedKey, record: previous };
    el('passkey-setup').hidden = true;
    el('confirm-passkey').hidden = false;
    el('cancel-passkey').hidden = false;
    el('confirm-passkey').focus();
  });
});

el('confirm-passkey').addEventListener('click', () => run(async token => {
  const pending = passkeySetup;
  if (!pending) return;
  if (!pending.credential) {
    pending.credential = await requestPasskey(createPasskey);
    if (token !== session) return;
    el('confirm-passkey').textContent = 'Vérifier et activer la clé d’accès';
    el('passkey-status').textContent = 'Vérifie que la clé d’accès peut ouvrir le coffre pour terminer.';
    return;
  }
  const secret = await requestPasskey(signal => readPasskey(pending.credential, signal));
  if (token !== session) {
    new Uint8Array(secret).fill(0);
    return;
  }
  const passkey = await protectKey(pending.credential, secret, pending.record, pending.key);
  await updatePasskey(pending.record, passkey, token);
}));

el('cancel-passkey').addEventListener('click', () => {
  if (!busy) clearPasskeySetup();
});

el('unlock-passkey').addEventListener('click', () => run(async token => {
  const previous = record;
  if (!previous?.passkey) return;
  if (previous.year < schoolYear()) {
    await refreshRecord();
    return;
  }
  const secret = await requestPasskey(signal => readPasskey(previous.passkey, signal));
  if (token !== session) {
    new Uint8Array(secret).fill(0);
    return;
  }
  let nextKey;
  let next;
  try {
    nextKey = await recoverKey(previous, secret);
    next = await decryptDirectory(previous, nextKey);
  } catch {
    throw new Error('La clé d’accès n’a pas pu ouvrir le coffre. Utilise le mot de passe.');
  }
  if (await refreshRecord() || token !== session) return;
  if (record?.revision !== previous.revision) {
    showLock();
    say('Les données ont changé. Réessaie.');
    return;
  }
  key = nextKey;
  directory = next;
  showDirectory();
  say('');
  el('directory-title').focus();
}));

async function resizeImage(file) {
  const supported = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) ||
    (!file.type && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name));
  if (!supported || file.size > 25 * 1024 * 1024) {
    throw new Error('Choisis une photo fictive JPEG, PNG, WebP, HEIC ou HEIF de 25 Mo maximum.');
  }
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const size = Math.min(400, image.naturalWidth, image.naturalHeight);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(image, (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    throw new Error('Ce navigateur ne peut pas lire cette image. Essaie avec une photo JPEG.');
  } finally {
    URL.revokeObjectURL(source);
  }
}

async function selectPhoto(input) {
  pickerOpenedAt = 0;
  const file = input.files[0];
  input.value = '';
  if (!file || !directory || busy) return;
  const selection = ++photoSelection;
  const status = el('photo-status');
  el('save-student').disabled = true;
  status.textContent = 'Préparation de la photo…';
  try {
    const photo = await resizeImage(file);
    if (selection !== photoSelection) return;
    draftPhoto = photo;
    showPhoto(photo);
    status.textContent = 'Photo prête. Enregistre la fiche pour la conserver.';
  } catch (error) {
    if (selection === photoSelection) status.textContent = error.message;
  } finally {
    if (selection === photoSelection) el('save-student').disabled = false;
  }
}

for (const [button, field] of [['take-photo', 'camera-file'], ['import-photo', 'library-file']]) {
  const input = el(field);
  el(button).addEventListener('click', () => {
    if (!directory || busy) return;
    pickerOpenedAt = Date.now();
    input.click();
  });
  input.addEventListener('cancel', () => { pickerOpenedAt = 0; });
  input.addEventListener('change', () => selectPhoto(input));
}
el('remove-photo').addEventListener('click', () => {
  if (busy) return;
  photoSelection++;
  draftPhoto = undefined;
  showPhoto(undefined);
  el('save-student').disabled = false;
  el('photo-status').textContent = 'Photo retirée. Enregistre la fiche pour confirmer.';
});
el('cancel-edit').addEventListener('click', () => {
  if (!busy) resetStudentForm();
});

el('unlock').addEventListener('submit', event => {
  event.preventDefault();
  const password = el('password').value;
  el('password').value = '';
  run(token => unlock(token, password));
});
el('reset').addEventListener('click', () => run(async token => {
  if (!confirm('Effacer définitivement toutes les données de test de cet appareil ?')) return;
  if (token !== session) return;
  const deleted = await replaceRecord(db, record?.revision, undefined);
  if (token !== session) return;
  await refreshRecord();
  if (token !== session) return;
  showLock();
  say(deleted ? 'Données de test effacées.' : 'Les données ont changé. Réessaie.');
}));
el('lock').addEventListener('click', () => {
  lock();
  el('password').focus();
});
function checkYearOnReturn() {
  if (record && record.year < schoolYear()) {
    lock();
    refreshRecord().catch(() => say('La vérification de l’année scolaire a échoué. Réessaie en déverrouillant.'));
  }
}

// L’appareil photo ou la photothèque peuvent masquer la page : on tolère ce cas
// pendant 2 minutes au plus. Toute autre mise en arrière-plan verrouille.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    if (!directory || !pickerOpenedAt || hiddenAt - pickerOpenedAt > pickerGraceMs) lock();
    return;
  }
  if (directory && pickerOpenedAt && Date.now() - hiddenAt > pickerGraceMs) lock();
  pickerOpenedAt = 0;
  checkYearOnReturn();
});

function armIdleLock() {
  clearTimeout(idleTimer);
  if (directory) idleTimer = setTimeout(() => {
    if (busy) return armIdleLock();
    lock();
    say('Verrouillage automatique après inactivité.');
  }, idleMinutes * 60 * 1000);
}
for (const type of ['pointerdown', 'keydown', 'scroll']) {
  document.addEventListener(type, () => { if (directory) armIdleLock(); }, { passive: true, capture: true });
}
window.addEventListener('pagehide', lock);
window.addEventListener('pageshow', event => { if (event.persisted) checkYearOnReturn(); });

el('classes').addEventListener('change', event => {
  if (busy) {
    event.target.value = activeClass;
    return;
  }
  resetStudentForm();
  activeClass = event.target.value;
  showDirectory();
  el('classes').focus();
});
el('add-class').addEventListener('submit', event => {
  event.preventDefault();
  run(async token => {
    const name = el('class-name').value.trim();
    if (!name) throw new Error('Saisis un nom de classe.');
    const group = { id: crypto.randomUUID(), name, students: [] };
    if (await save([...directory, group], token, group.id, 'Classe ajoutée.')) event.target.reset();
  });
});
el('remove-class').addEventListener('click', () => run(async token => {
  const group = directory.find(item => item.id === activeClass);
  if (!group || !confirm('Supprimer la classe « ' + group.name + ' » et toutes ses fiches ?')) return;
  await save(directory.filter(item => item.id !== group.id), token, undefined, 'Classe supprimée.');
}));
el('rename-class').addEventListener('submit', event => {
  event.preventDefault();
  run(async token => {
    const name = el('rename-class-name').value.trim();
    if (!name) throw new Error('Saisis un nom de classe.');
    const next = directory.map(group => group.id === activeClass ? { ...group, name } : group);
    await save(next, token, activeClass, 'Classe renommée.');
  });
});
el('simulate-year').addEventListener('click', () => run(async token => {
  if (!confirm('Simuler le 1er août ? Toutes les classes, fiches et photos de test seront effacées.')) return;
  const revision = record?.revision;
  lock();
  if (!await ageRecord(db, revision)) {
    await refreshRecord();
    showLock();
    say('Les données ont changé. Réessaie.');
    return;
  }
  const expired = await refreshRecord();
  showLock();
  if (!expired) say('La purge n’a pas eu lieu. Signale ce résultat.');
}));
el('add-student').addEventListener('submit', event => {
  event.preventDefault();
  if (el('save-student').disabled) return;
  run(async token => {
    const group = directory.find(item => item.id === activeClass);
    if (!group) return;
    const target = directory.find(item => item.id === el('student-class').value) || group;
    const name = el('first-name').value.trim();
    if (!name) throw new Error('Saisis un prénom fictif.');
    const previous = group.students.find(student => student.id === editingStudent);
    const { photo: _old, ...kept } = previous || {};
    const student = previous ? { ...kept, name, ...(draftPhoto && { photo: draftPhoto }) } : {
      id: crypto.randomUUID(), name, ...(draftPhoto && { photo: draftPhoto }),
      avatar: Math.floor(Math.random() * avatars.length)
    };
    const next = directory.map(item => {
      let students = item.students.filter(entry => entry.id !== student.id);
      if (item.id === target.id) {
        const index = item.students.findIndex(entry => entry.id === student.id);
        if (index >= 0) students = item.students.map(entry => entry.id === student.id ? student : entry);
        else students = [...students, student];
      }
      return { ...item, students };
    });
    const message = !previous ? 'Fiche ajoutée.'
      : target.id !== group.id ? 'Fiche déplacée vers « ' + target.name + ' ».' : 'Fiche modifiée.';
    if (await save(next, token, target.id, message)) {
      resetStudentForm();
    }
  });
});

async function enableOffline() {
  try {
    if (!('serviceWorker' in navigator)) throw new Error();
    const worker = navigator.serviceWorker;
    const ready = () => { el('offline').textContent = 'Mode hors ligne prêt sur cet appareil.'; };
    const hadController = !!worker.controller;
    worker.addEventListener('controllerchange', () => {
      if (!worker.controller) return;
      el('offline').textContent = hadController
        ? 'Nouvelle version installée. Ferme puis rouvre le Trombinoscope pour l’utiliser.'
        : 'Mode hors ligne prêt sur cet appareil.';
    });
    const registration = await worker.register('./sw.js', { updateViaCache: 'none' });
    if (navigator.onLine) registration.update().catch(() => {});
    if (worker.controller) ready();
    const pending = registration.installing || registration.waiting;
    if (pending) pending.addEventListener('statechange', () => {
      if (pending.state === 'redundant' && !worker.controller) {
        el('offline').textContent = 'Mode hors ligne indisponible. Recharge la page avec une connexion.';
      }
    });
  } catch {
    el('offline').textContent = 'Mode hors ligne indisponible dans ce navigateur.';
  }
}

async function start() {
  if (!window.isSecureContext || !crypto.subtle || location.protocol === 'file:') {
    el('lock-title').textContent = 'Ouvre l’adresse HTTPS';
    el('lock-help').textContent = 'Publie les fichiers sur GitHub Pages puis ouvre le lien du site.';
    el('offline').textContent = '';
    return;
  }
  enableOffline();
  try {
    db = await openVault();
    await refreshRecord();
    showLock();
  } catch {
    el('unlock').hidden = true;
    el('lock-title').textContent = 'Stockage local indisponible';
    el('lock-help').textContent = 'Vérifie les réglages de Safari ou du navigateur, puis recharge la page.';
  }
}

start();
