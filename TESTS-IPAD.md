# Procédure de test sur iPad — V3.3

Uniquement avec des **prénoms et photos fictifs** (photos d'objets, de peluches, etc.).

Préparation : iPad à jour (iPadOS 18 ou plus récent), code de l'iPad activé, Touch ID configuré. Notez pour chaque test : ✅ / ❌ et une remarque.

> Important : l'application ouverte depuis l'écran d'accueil et la page ouverte dans Safari ont **deux stockages séparés**. Faites tous les tests depuis l'icône de l'écran d'accueil.

## 0. Mise à jour depuis la V3.2 (données conservées)
1. Avec le Wi-Fi, ouvrez le Trombinoscope depuis l'écran d'accueil.
2. Si l'en-tête affiche encore « V3.2 » : fermez l'app (balayer vers le haut dans le sélecteur d'apps), attendez 1 minute, rouvrez. Répétez au plus 3 fois.
3. ✅ attendu : « V3.3 » dans l'en-tête, votre ancien mot de passe ouvre l'espace, vos fiches de test sont toujours là.

## 1. Modification des fiches
1. Touchez **Modifier** sur une fiche, changez le prénom, **Enregistrer**. ✅ nouveau prénom affiché.
2. Modifier → choisissez une autre classe dans **Classe** → Enregistrer. ✅ message « Fiche déplacée », la fiche apparaît dans l'autre classe et plus dans la première.
3. Modifier → **Retirer la photo** → Enregistrer. ✅ avatar à la place de la photo.
4. Modifier → **Annuler la modification**. ✅ aucune modification.
5. Renommez une classe. ✅ nouveau nom dans la liste.

## 2. Photographies
1. **Prendre une photo** : l'appareil photo s'ouvre, prenez une photo d'un objet, validez « Utiliser la photo ». ✅ aperçu visible, l'app n'est **pas** verrouillée, la fiche s'enregistre.
2. Vérifiez dans l'app Photos : ✅ la photo prise n'y figure pas.
3. **Importer une photo** depuis la photothèque. ✅ aperçu carré, fiche enregistrée.
4. Photo prise en mode portrait (vertical) puis paysage : ✅ portrait bien orienté, non déformé.
5. Ouvrez l'appareil photo puis attendez plus de 2 minutes avant de valider. ✅ au retour, l'app est verrouillée (comportement voulu).

## 3. Verrouillage
1. App ouverte → bouton principal / balayage vers l'accueil → rouvrez. ✅ mot de passe demandé.
2. Fermez complètement l'app → rouvrez. ✅ mot de passe demandé, données conservées.
3. Laissez l'app ouverte sans y toucher 5 minutes (désactivez temporairement le verrouillage automatique de l'écran de l'iPad). ✅ « Verrouillage automatique après inactivité ».
4. Mauvais mot de passe. ✅ refusé.

## 4. Hors ligne
1. Ouvrez l'app une fois avec le Wi-Fi (message « Mode hors ligne prêt sur cet appareil »).
2. Activez le **mode Avion**, fermez complètement l'app, rouvrez-la.
3. ✅ l'app s'affiche, se déverrouille, permet d'ajouter une fiche et une photo.
4. Désactivez le mode Avion. ✅ les données ajoutées hors ligne sont là.

## 5. Réinitialisation annuelle
Sur un iPad administré, la date est souvent verrouillée : utilisez la **Zone de test**.
1. Vérifiez la ligne « Prochaine purge annuelle : 1er août 2027 ».
2. **Simuler le passage au 1er août** → confirmez.
3. ✅ message « Les données de l'année précédente ont été effacées », écran « Créer un espace de test ».
4. Fermez et rouvrez l'app. ✅ aucune ancienne classe ni photo.
5. (Facultatif, si la date est modifiable) Réglages → Général → Date et heure → réglez au 1er août de l'année suivante → rouvrez l'app → ✅ même résultat. Remettez la date automatique.

## 6. Sécurité du stockage (contrôle depuis Windows, sans Mac)
L'inspection directe d'IndexedDB sur iPad nécessite un Mac. Le chiffrement a été vérifié automatiquement dans un navigateur de bureau avec le même code. Pour un contrôle vous-même sous Windows :
1. Ouvrez le site dans Chrome ou Edge sur le PC, créez un espace de test, ajoutez une fiche « Zorglub » avec photo.
2. F12 → onglet **Application** → IndexedDB → `trombinoscope-demo:/…` → `vault` → `directory`.
3. ✅ seuls les champs `revision`, `year`, `salt`, `iv`, `cipher` apparaissent ; « Zorglub » n'est lisible nulle part.

## 7. Touch ID (clé d'accès)
1. Dans le panneau **Clé d'accès**, confirmez le mot de passe → **Continuer** → **Créer une clé d'accès** → Touch ID.
2. **Vérifier et activer la clé d'accès** → Touch ID. ✅ « Clé d'accès activée ».
   ❌ si le message dit que la clé ne fournit pas le secret nécessaire : PRF indisponible sur cet iPad (voir `SECURITE.md` §6), notez la version d'iPadOS et transmettez au service informatique.
3. Verrouillez → **Déverrouiller avec une clé d'accès** → Touch ID. ✅ ouverture sans mot de passe.
4. Annulez Touch ID. ✅ le mot de passe reste utilisable.
5. Panneau Clé d'accès → mot de passe → **Désactiver la clé d'accès**. ✅ seul le mot de passe fonctionne.

## 8. Contrôles MDM à demander au service informatique
- iPadOS ≥ 18.4, iPad non partagé (pas de « Shared iPad »).
- Safari autorisé, « Ajouter à l'écran d'accueil » autorisé, `github.io` non bloqué par le filtrage web.
- Appareil photo autorisé.
- Trousseau iCloud : autorisé ou non (impact sur Touch ID).
- Code de l'iPad obligatoire, verrouillage automatique de l'écran ≤ 5 min.
- Pas de sauvegarde/MDM effaçant les données des sites web.
