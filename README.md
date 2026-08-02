# Carnet

Framework de PWA d'apprentissage par répétition espacée. Hors-ligne, sans backend,
sans compte. Le moteur ignore le sujet enseigné : un domaine = un **pack de contenu**
(fichier JSON), ajouté sans toucher au code.

Premier pack : grammaire anglaise.

## Démarrer

```bash
npm install
npm run dev
```

| Script | Effet |
| --- | --- |
| `npm run dev` | serveur de développement (http://localhost:5173) |
| `npm run build` | typecheck puis build statique dans `dist/` |
| `npm run typecheck` | typecheck seul |
| `npm run preview` | sert le build de production (http://localhost:4173) |
| `npm run icons` | régénère les icônes depuis `scripts/make-icons.mjs` |

Le service worker n'est actif que sur le build de production : pour tester
l'installation ou le hors-ligne, passer par `npm run build && npm run preview`,
jamais par `npm run dev`.

## Structure

```
src/
  engine/
    scheduler.ts        enveloppe ts-fsrs + porte de graduation
    grading.ts          correction normalisée (tolérante sur la forme, stricte sur le sens)
    session.ts          composition de la session, quota de nouveautés, persistance des réponses
    exercises/          un fichier par type d'exercice + registre
  storage/
    db.ts               schéma Dexie versionné (cards / reviews / kv)
    cards.ts            synchronisation pack → cartes, requêtes de sélection
  packs/
    schema.ts           types du pack de contenu
    validate.ts         validation au chargement
    index.ts            chargement (fetch de /packs/<id>.json)
  ui/
    tokens.css          design tokens — seule source des couleurs et des rythmes
    app.css             styles
    screens/            accueil, révision, bilan
public/packs/           packs servis en statique
```

## Deux idées à connaître avant de toucher au code

**Une carte = un exercice.** Chaque exercice d'un item porte son propre état FSRS,
sous l'identifiant `packId:itemId:index`. Réviser un item ne fait pas avancer
mécaniquement tous ses exercices.

**La porte de graduation.** Une carte ne part en révision longue qu'après deux
réussites sur des jours *différents*, dont au moins une en session mélangée
(≥ 2 notions). Tant que la porte n'est pas franchie, l'échéance est plafonnée à
24 h — sans jamais toucher à `stability` / `difficulty`, pour que le modèle FSRS
reste intact. Voir `spacedSuccesses` et `interleavedSuccess` sur `CardRecord`.

## Ajouter un type d'exercice

1. Écrire `src/engine/exercises/monType.ts` exportant un `ExerciseRenderer`
   (`render` → poignée de saisie, `grade` → verdict).
2. L'ajouter à `RENDERERS` dans `src/engine/exercises/index.ts`.

Rien d'autre ne bouge : ni le moteur, ni la session, ni l'interface.

## Hors-ligne et mises à jour

Deux stratégies de cache, volontairement distinctes :

- **coquille de l'application** (HTML, JS, CSS, icônes) : précachée, servie
  cache-first. C'est ce qui permet d'ouvrir Carnet en mode avion.
- **packs de contenu** (`/packs/*.json`) : stale-while-revalidate, dans un cache
  séparé (`carnet-packs`). Corriger une phrase d'exercice n'invalide donc pas
  tout le cache de l'application, et inversement.

Une nouvelle version ne s'installe **jamais** d'elle-même : le worker attend, et
l'accueil propose un bouton « Redémarrer ». Une session de révision ne peut pas
être interrompue par un rechargement surprise.

Le stockage persistant (`navigator.storage.persist()`) est demandé après une
session terminée, pas au chargement — et au plus une fois par jour tant qu'il
n'est pas accordé. Sans lui, iOS peut évincer IndexedDB après une longue
inactivité ; c'est aussi la raison d'être de l'export manuel prévu à l'étape 4.

## Déploiement

```bash
npm run build           # -> dist/, à servir tel quel
```

Pour un sous-chemin (GitHub Pages par exemple) :

```bash
CARNET_BASE=/carnet/ npm run build
```

Un service worker exige un **contexte sécurisé** : `https://` ou `localhost`.
Une adresse de réseau local en `http://192.168.…` ne suffit pas — sur iPhone,
l'application se chargerait mais ne s'installerait pas et ne fonctionnerait pas
hors connexion. Pour tester sur un vrai téléphone, déployer `dist/` sur un
hébergement statique en HTTPS.

## Ajouter un pack

Déposer `public/packs/<id>.json` conforme à `ContentPack` (`src/packs/schema.ts`),
puis charger via `loadPack('<id>')`. Le pack est validé à l'ouverture ; en cas
d'erreur, l'application affiche les problèmes et **ne touche pas** à la progression
enregistrée.

Mettre à jour un pack est sûr : `syncPackCards` crée les cartes manquantes, retire
celles dont l'exercice a disparu, et laisse intact l'état FSRS de tout le reste.

## État d'avancement

| Étape | Statut |
| --- | --- |
| 1. Squelette — Dexie, FSRS, boucle de révision persistante | fait |
| 2. PWA réelle — manifest, service worker, meta iOS | fait, reste à valider sur iPhone et Android réels |
| 3. Contenu — 5 types d'exercice, 145 unités | à faire (2 types sur 5, pack d'amorçage à 3 unités) |
| 4. Rétention — export/import, série hebdomadaire | à faire |
| 5. Direction artistique | à faire (tokens posés, typographie et filigrane à venir) |

L'inspecteur d'état en bas de l'écran d'accueil (`renderDevBar`) est un outil de
développement, à retirer à l'étape 5.
