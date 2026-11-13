# Trombinoscope scolaire — V3.4

Application web installable (PWA) pour iPad : classes, fiches élèves et portraits, **stockés uniquement sur l'iPad et chiffrés** (AES-GCM 256, clé dérivée du mot de passe). Aucun serveur, fonctionne hors ligne.

⚠️ Démonstration : **données fictives uniquement** tant que la sécurité n'est pas validée et que l'établissement n'a pas donné son accord.

- Audit et choix de sécurité : [`SECURITE.md`](SECURITE.md)
- Procédure de test sur iPad : [`TESTS-IPAD.md`](TESTS-IPAD.md)

## Fichiers publiés

`index.html`, `app.js`, `vault.js`, `passkey.js`, `sw.js`, `styles.css`, `manifest.webmanifest`, `icon-180.png`, `icon-192.png`, `icon-512.png`.

## Déployer depuis Windows (sans Mac)

### Mise à jour par le site GitHub (le plus simple)
1. Sur le PC, décompressez l'archive V3.4.
2. Ouvrez https://github.com/cvitre23/Tonbinoscope-V1.0 → **Add file** → **Upload files**.
3. Glissez **tous** les fichiers ci-dessus (plus `README.md`, `SECURITE.md`, `TESTS-IPAD.md`). Les fichiers de même nom sont remplacés.
4. Message de commit : « Publier le Trombinoscope V3.4 » → **Commit changes** directement sur `main`.
5. **Settings** → **Pages** : *Source* = « Deploy from a branch », branche `main`, dossier `/ (root)` (déjà configuré si la V3.2 est en ligne).
6. Onglet **Actions** : attendez que « pages build and deployment » soit vert (1 à 2 minutes).
7. Ouvrez l'adresse du site dans Edge/Chrome sur le PC : l'en-tête doit afficher « V3.4 ». Faites Ctrl+F5 si besoin.

Ne renommez pas le dépôt et ne changez pas le chemin du site : les données déjà présentes sur l'iPad sont liées à cette adresse.

### Variante : GitHub Desktop
Installer GitHub Desktop → *Clone* du dépôt → copier les fichiers V3.4 dans le dossier → *Commit to main* → *Push origin*.

### Installer sur l'iPad
1. Ouvrez l'adresse HTTPS du site dans **Safari**.
2. Bouton Partager → **Sur l'écran d'accueil** → Ajouter.
3. Ouvrez toujours l'application depuis cette icône (stockage distinct de Safari).

### Publier une version suivante
Changez le nom du cache dans `sw.js` (`'v3.4'` → `'v3.5'`) et le libellé dans `index.html`. Sans changement de `sw.js`, les iPad garderont l'ancienne version en cache.
