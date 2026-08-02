# Carnet

**Apprendre n'importe quoi, et le retenir pour de bon.**
En ligne : https://ar0698.github.io/carnet/

Carnet est une application d'apprentissage par répétition espacée. On y ouvre un
*carnet* — grammaire anglaise, vocabulaire, droit, code, dates — et on y revient
quelques minutes par jour ; l'application décide seule de ce qui doit être revu
et quand, pour que ce soit encore là dans six mois.

PWA hors ligne, sans backend, sans compte. Le moteur ignore le sujet enseigné :
un domaine = un **pack de contenu** (fichier JSON), ajouté sans toucher au code.

Premier carnet livré : grammaire anglaise.

## Ce que fait Carnet pour la mémoire

Cinq décisions, toutes prises contre le confort immédiat — c'est la difficulté
qui fixe, pas la fluidité.

| Décision | Pourquoi |
| --- | --- |
| Répondre de mémoire, sans relire d'abord | Récupérer un souvenir le renforce ; le relire donne surtout l'illusion de le savoir. |
| Espacer, et allonger tant que ça passe | Une carte retrouvée s'éloigne : demain, trois jours, une semaine, un mois. Ratée, elle revient dans la journée. C'est FSRS-6 qui décide (`engine/scheduler.ts`). |
| Ne rien déclarer « su » trop vite | La **porte de graduation** : deux réussites sur des jours *différents*, dont une en session mélangée. Avant ça, l'échéance est plafonnée à 24 h. |
| Mélanger les notions dans une session | Réviser un chapitre en bloc donne de bons résultats sur le moment et rien la semaine suivante. |
| Plafonner les nouveautés à 10 par jour | Ouvrir 60 notions un dimanche, c'est 60 révisions à porter tous les jours suivants. |

Les révisions à plusieurs jours d'écart sont donc le fonctionnement normal, pas
une option : l'accueil affiche ce qui est dû maintenant, et quand la file est
vide, la date du prochain rendez-vous. Carnet n'envoie pas de notification — il
faut ouvrir l'application. Une carte en retard n'est jamais perdue : elle
remonte en tête dès l'ouverture suivante.

## Deux façons de répondre

**À l'écran.** On tape la réponse, l'application corrige : comparaison mot à
mot, explication de l'erreur quand elle est prévue dans le contenu. Le temps de
réponse sert à distinguer ce qui est venu tout seul de ce qui a été arraché.

**Sur le cahier** — case « J'ai un cahier à côté de moi », à cocher avant de
lancer une session. L'énoncé s'affiche sans champ de saisie, la réponse s'écrit
à la main, puis l'application montre la sienne et c'est l'apprenante qui juge :
*sans hésiter*, *en cherchant*, *non*. Deux conséquences dans le code :

- le chronomètre ne mesure plus le rappel mais l'écriture — le jugement déclaré
  (`Answer.effort`) remplace donc la mesure dans `ratingFor()` ;
- une carte écrite à la main prend plus longtemps : le budget passe de 45 à
  75 secondes par carte, pour tenir la durée annoncée plutôt que le nombre
  d'exercices.

Le prix du mode cahier est l'auto-correction : personne ne relit la copie. Il
suppose d'être honnête avec soi-même — « à peu près juste » n'est pas juste.

## Écouter les phrases

Un bouton **Écouter** accompagne la réponse juste, à l'écran comme sur le
cahier. Il s'appuie sur `speechSynthesis` : la voix déjà installée sur
l'appareil, aucun fichier audio, aucun appel réseau, rien qui sorte du
téléphone. La langue lue est `meta.contentLocale` du pack (`en-GB` ici), pas
celle des consignes.

Seule la phrase **juste et complète** est prononcée (`spokenSentence()`) — un
`fill_blank` est lu une fois son trou comblé. La phrase de départ d'un
`spot_error` n'a délibérément pas de bouton : elle est fausse, et une faute
entendue s'installe aussi bien qu'une forme correcte.

Là où l'API n'existe pas, le bouton n'apparaît pas et rien d'autre ne change.

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
  storage/
    prefs.ts            réglages de session (mode cahier)
  ui/
    tokens.css          design tokens — seule source des couleurs et des rythmes
    app.css             styles
    speech.ts           lecture à voix haute (speechSynthesis)
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
   (`render` → poignée de saisie, `grade` → verdict, `statement` → le même
   énoncé sans saisie, pour le mode cahier ; ce dernier est facultatif, à
   défaut la consigne nue est affichée).
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

Le déploiement est automatique : tout `git push` sur `main` déclenche
[deploy.yml](.github/workflows/deploy.yml), qui reconstruit et publie sur
GitHub Pages. Le préfixe d'URL est déduit du nom du dépôt, rien à régler.

Pour reproduire ce build en local :

```bash
CARNET_BASE=/carnet/ npm run build
```

Un service worker exige un **contexte sécurisé** : `https://` ou `localhost`.
Une adresse de réseau local en `http://192.168.…` ne suffit pas — sur iPhone,
l'application se chargerait mais ne s'installerait pas et ne fonctionnerait pas
hors connexion. Pour tester sur un vrai téléphone, déployer `dist/` sur un
hébergement statique en HTTPS.

## Ajouter un carnet (pack de contenu)

Déposer `public/packs/<id>.json` conforme à `ContentPack` (`src/packs/schema.ts`),
puis charger via `loadPack('<id>')`. Le pack est validé à l'ouverture ; en cas
d'erreur, l'application affiche les problèmes et **ne touche pas** à la progression
enregistrée.

`meta.locale` est la langue des consignes ; `meta.contentLocale`, facultatif,
celle de la matière — utile seulement quand les deux diffèrent, et c'est celle
qui est lue à voix haute. Un carnet d'histoire écrit en français n'a pas besoin
de le renseigner.

Mettre à jour un pack est sûr : `syncPackCards` crée les cartes manquantes, retire
celles dont l'exercice a disparu, et laisse intact l'état FSRS de tout le reste.

## État d'avancement

| Étape | Statut |
| --- | --- |
| 1. Squelette — Dexie, FSRS, boucle de révision persistante | fait |
| 2. PWA réelle — manifest, service worker, meta iOS | fait, reste à valider sur iPhone et Android réels |
| 3. Contenu — 5 types d'exercice, 145 unités | en cours (5 types sur 5, 68/145 unités, 544 exercices) |
| 4. Modes de réponse — écran, cahier, écoute | fait |
| 5. Rétention — export/import, série hebdomadaire | à faire |
| 6. Direction artistique | à faire (tokens posés, typographie et filigrane à venir) |
