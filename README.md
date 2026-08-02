# Go to Bristol

**L'anglais qu'il faut pour y être chez soi.**
En ligne : https://ar0698.github.io/carnet/

Trois carnets, un seul moteur de mémoire. La grammaire pour la mécanique, la
culture pour la ville, et Discovery pour les mots qu'on ramasse en chemin et
qu'on note soi-même. On y revient quelques minutes par jour ; l'application
décide seule de ce qui doit être revu et quand, pour que ce soit encore là dans
six mois.

PWA hors ligne, sans backend, sans compte. Le moteur ignore le sujet enseigné :
un domaine = un **pack de contenu**, ajouté sans toucher au code.

## Trois carnets

| Carnet | Ce qu'on y travaille | D'où vient le contenu |
| --- | --- | --- |
| **Grammaire** | la mécanique de la langue, unité par unité | `public/packs/english-grammar.json` |
| **Culture** | Bristol racontée en anglais, et les mots qu'on y attrape | `public/packs/bristol-culture.json` |
| **Discovery** | le vocabulaire saisi à la main | IndexedDB, écrit par l'apprenante |

Chacun a sa propre file d'échéances, son propre quota de nouveautés et sa propre
progression. Rien ne se mélange entre carnets : réviser la grammaire ne fait pas
avancer le vocabulaire.

La bascule technique tient en une idée : Discovery est exposé au moteur comme un
`ContentPack` ordinaire, reconstruit à la volée depuis la base
(`storage/vocab.ts`). Ni la session, ni FSRS, ni la porte de graduation ne
savent que ce carnet-là n'a pas de fichier.

## Ce que l'application fait pour la mémoire

Cinq décisions, toutes prises contre le confort immédiat — c'est la difficulté
qui fixe, pas la fluidité.

| Décision | Pourquoi |
| --- | --- |
| Répondre de mémoire, sans relire d'abord | Récupérer un souvenir le renforce ; le relire donne surtout l'illusion de le savoir. |
| Espacer, et allonger tant que ça passe | Une carte retrouvée s'éloigne : demain, trois jours, une semaine, un mois. Ratée, elle revient dans la journée. C'est FSRS-6 qui décide (`engine/scheduler.ts`). |
| Ne rien déclarer « su » trop vite | La **porte de graduation** : deux réussites sur des jours *différents*, dont une en session mélangée. Avant ça, l'échéance est plafonnée à 24 h. |
| Mélanger les notions dans une session | Réviser un chapitre en bloc donne de bons résultats sur le moment et rien la semaine suivante. |
| Plafonner les nouveautés à 10 par jour et par carnet | Ouvrir 60 notions un dimanche, c'est 60 révisions à porter tous les jours suivants. |

Les révisions à plusieurs jours d'écart sont donc le fonctionnement normal, pas
une option : l'accueil affiche ce qui est dû maintenant, et quand une file est
vide, la date du prochain rendez-vous. L'application n'envoie pas de
notification — il faut l'ouvrir. Une carte en retard n'est jamais perdue : elle
remonte en tête dès l'ouverture suivante.

## Discovery — le carnet qu'on écrit soi-même

Un bouton **J'ai un mot à ajouter**, atteignable depuis l'accueil. Deux champs
obligatoires — l'expression anglaise, ce qu'elle veut dire — et trois
facultatifs : une phrase d'exemple, une remarque, une étiquette. C'est tout, et
c'est volontaire : si l'ajout prend plus de dix secondes, le mot se perd avant
d'être noté.

Chaque mot devient une **notion** à part entière, avec un ou deux exercices :

- une **production** (français → anglais), toujours ;
- un **texte à trou** bâti sur la phrase d'exemple, si elle contient
  l'expression — un mot vu en contexte tient bien mieux qu'un mot seul ;
- un **choix multiple** de secours, dont les distracteurs sont les mots voisins
  du carnet. Il n'apparaît qu'après deux échecs de suite, et ne porte pas de
  carte.

Une notion par mot, et non un seul « vocabulaire » global : l'entrelacement du
moteur travaille sur les notions, et la porte de graduation exige une réussite
en session mélangée. Un vocabulaire d'une seule notion ne pourrait jamais être
rangé comme su.

L'écran **Mon vocabulaire** liste tout, avec le sens, l'exemple, l'état
d'acquisition et un bouton Écouter. Recherche à partir de huit mots. Modification
et suppression en deux temps.

### La règle qui protège ce carnet

`syncPackCards` retire les cartes dont l'exercice a disparu du pack. C'est juste
pour un pack téléchargé — son contenu fait autorité. Ce serait catastrophique
pour Discovery : un pack vide n'y signifie pas « le contenu a disparu », il peut
signifier « la lecture a échoué », et l'élagage emporterait des mois de travail.

Le carnet personnel est donc synchronisé avec `{ prune: false }` et fait son
ménage **mot par mot**, au moment où on le modifie : effacer la phrase d'exemple
retire le texte à trou et lui seul ; supprimer un mot retire ses cartes et les
réponses qui s'y rapportaient. Aucun balayage global, jamais.

## Culture — la ville comme matière

Six unités : le pont suspendu et Brunel, la Fiesta des montgolfières, Banksy et
Stokes Croft, le port et la ss Great Britain, St Nicholas Market, et l'argot
bristolien. Dix-huit expressions, cinquante-quatre exercices.

Chaque item porte un court passage anglais dans `fields.passage` — un champ
libre que le moteur n'interprète pas, prévu par le schéma. Les exercices en sont
tirés : ce sont les mots du texte qu'on révise, pas des questions de culture
générale.

Le passage n'apparaît **qu'après** la réponse. Il contient la forme attendue :
l'afficher d'abord transformerait un rappel en recopie. Une fois la réponse
donnée, relire la phrase dans son contexte est exactement ce qui ancre le mot.

## Deux façons de répondre

**À l'écran.** On tape la réponse, l'application corrige : comparaison mot à
mot, explication de l'erreur quand elle est prévue dans le contenu. Le temps de
réponse sert à distinguer ce qui est venu tout seul de ce qui a été arraché.

**Sur le cahier** — case « J'ai un cahier à côté de moi », valable pour les trois
carnets. L'énoncé s'affiche sans champ de saisie, la réponse s'écrit à la main,
puis l'application montre la sienne et c'est l'apprenante qui juge : *sans
hésiter*, *en cherchant*, *non*. Deux conséquences dans le code :

- le chronomètre ne mesure plus le rappel mais l'écriture — le jugement déclaré
  (`Answer.effort`) remplace donc la mesure dans `ratingFor()` ;
- une carte écrite à la main prend plus longtemps : le budget passe de 45 à
  75 secondes par carte, pour tenir la durée annoncée plutôt que le nombre
  d'exercices.

Le prix du mode cahier est l'auto-correction : personne ne relit la copie. Il
suppose d'être honnête avec soi-même — « à peu près juste » n'est pas juste.

## Écouter les phrases

Un bouton **Écouter** accompagne la réponse juste, à l'écran comme sur le
cahier, ainsi que chaque mot de Discovery et chaque passage de Culture. Il
s'appuie sur `speechSynthesis` : la voix déjà installée sur l'appareil, aucun
fichier audio, aucun appel réseau, rien qui sorte du téléphone. La langue lue est
`meta.contentLocale` du pack (`en-GB` partout ici), pas celle des consignes.

Seule la phrase **juste et complète** est prononcée (`spokenSentence()`) — un
`fill_blank` est lu une fois son trou comblé. La phrase de départ d'un
`spot_error` n'a délibérément pas de bouton : elle est fausse, et une faute
entendue s'installe aussi bien qu'une forme correcte.

Là où l'API n'existe pas, le bouton n'apparaît pas et rien d'autre ne change.

## Sauvegarde

Les packs se retéléchargent ; les mots de Discovery, non. C'est la seule donnée
irremplaçable de l'application, et iOS peut évincer IndexedDB après une longue
inactivité — `navigator.storage.persist()` est une demande, pas une garantie.

L'écran **Sauvegarde** exporte tout dans un fichier JSON lisible : vocabulaire,
état de toutes les cartes, historique des réponses, réglages. Sur iPhone, la
feuille de partage double le téléchargement, que Safari ne descend pas toujours
dans Fichiers.

L'import **remplace**, il ne fusionne pas. Fusionner supposerait d'arbitrer entre
deux états d'une même carte sans pouvoir demander ; le remplacement, lui, est
prévisible. L'écran montre donc en chiffres ce qui part et ce qui arrive avant
de rien écrire, et tout se joue dans une seule transaction.

Un détail qui compte : les dates traversent le JSON en texte et sont réveillées
à la lecture (`parseBackup`). Sans cela `card.due` serait une chaîne, les
comparaisons d'échéance se feraient en ordre alphabétique, et la planification
partirait en morceaux sans lever la moindre erreur.

## Direction artistique

Tout tient dans `src/ui/tokens.css` : c'est la seule source des couleurs et des
rythmes, et aucune valeur brute ne figure ailleurs dans les feuilles de style ni
dans les illustrations.

La palette est relevée sur l'aquarelle de couverture et sur les photos du
voyage — papier grainé et encre brune du dessin, bleu pétrole, jaune des
montgolfières, brique de Stokes Croft, vert des parcs, pierre de Bath. Les noms
disent le rôle et l'origine : `--harbour` porte les actions, `--brick` les
erreurs, `--park` les réussites, `--balloon` les mises en garde.

Les illustrations (`src/ui/art.ts`) sont **vectorielles et originales**, écrites
dans le registre de l'aquarelle : lavis qui bavent — un `feTurbulence` déplacé,
seul moyen honnête d'obtenir un bord de pinceau sans texture bitmap — et trait
d'encre par-dessus. Elles pèsent quelques kilo-octets, restent nettes à toutes
les tailles et fonctionnent en mode avion. Une photo nette à côté d'une
aquarelle, l'un des deux perd toujours.

Le mouvement reprend les mêmes codes, et rien d'autre : le lavis qui se diffuse à
l'apparition d'une carte, le câble du pont qui se trace, les montgolfières qui
dérivent. Aucune durée n'est écrite en dur — toutes viennent des tokens, si bien
que `prefers-reduced-motion` les met à zéro d'un seul endroit.

Les polices (Bricolage Grotesque, Inter, Kalam) sont auto-hébergées en
sous-ensemble latin uniquement. Les paquets `@fontsource` livrent aussi le
cyrillique, le grec et le vietnamien : importer leur feuille complète ferait
entrer une douzaine de `.woff2` dans le précache pour des alphabets qu'aucun
carnet n'écrira. Les faces sont donc déclarées à la main dans
`src/ui/fonts.css`.

## Démarrer

```bash
npm install
npm run dev
```

| Script | Effet |
| --- | --- |
| `npm run dev` | serveur de développement (http://localhost:5173) |
| `npm run build` | packs, typecheck, puis build statique dans `dist/` |
| `npm run pack` | reconstruit les deux packs de contenu |
| `npm run typecheck` | typecheck seul |
| `npm run preview` | sert le build de production (http://localhost:4173) |
| `npm run icons` | régénère les icônes depuis `scripts/make-icons.mjs` |

Le service worker n'est actif que sur le build de production : pour tester
l'installation ou le hors-ligne, passer par `npm run build && npm run preview`,
jamais par `npm run dev`.

## Structure

```
src/
  carnets.ts            racine de composition : ouvre les trois carnets
  engine/
    scheduler.ts        enveloppe ts-fsrs + porte de graduation
    grading.ts          correction normalisée (tolérante sur la forme, stricte sur le sens)
    session.ts          composition de la session, quota de nouveautés, persistance
    exercises/          un fichier par type d'exercice + registre
  storage/
    db.ts               schéma Dexie versionné (cards / reviews / kv / vocab)
    cards.ts            synchronisation pack → cartes, requêtes de sélection
    vocab.ts            carnet Discovery : stockage et vue « pack »
    backup.ts           export / import de sauvegarde
    prefs.ts            réglages de session (mode cahier)
  packs/
    schema.ts           types du pack de contenu
    validate.ts         validation au chargement
    index.ts            chargement (fetch de /packs/<id>.json)
  ui/
    tokens.css          design tokens — seule source des couleurs et des rythmes
    fonts.css           faces auto-hébergées, sous-ensemble latin
    art.ts              illustrations vectorielles
    app.css             styles
    speech.ts           lecture à voix haute (speechSynthesis)
    screens/            accueil, révision, bilan, vocabulaire, sauvegarde
content/<pack>/         sources du contenu, une unité par fichier
public/packs/           packs assemblés, servis en statique
```

## Trois idées à connaître avant de toucher au code

**Une carte = un exercice.** Chaque exercice d'un item porte son propre état
FSRS, sous l'identifiant `packId:itemId:index`. Réviser un item ne fait pas
avancer mécaniquement tous ses exercices. L'ordre des exercices d'un mot
Discovery est donc un contrat : la production reste en tête, le choix multiple
en queue, pour qu'apparaître ou disparaître ne décale jamais un identifiant.

**La porte de graduation.** Une carte ne part en révision longue qu'après deux
réussites sur des jours *différents*, dont au moins une en session mélangée
(≥ 2 notions). Tant que la porte n'est pas franchie, l'échéance est plafonnée à
24 h — sans jamais toucher à `stability` / `difficulty`, pour que le modèle FSRS
reste intact. Voir `spacedSuccesses` et `interleavedSuccess` sur `CardRecord`.

**Un seul trou par `fill_blank`.** Le champ de saisie ne remplace que le premier
`___`, tandis que `spokenSentence()` recolle la réponse à *chaque* marqueur :
deux trous dans une phrase donnent un exercice incomplet et une lecture à voix
haute qui répète la réponse. `scripts/build-pack.mjs` refuse le pack dans ce cas.

## Ajouter un type d'exercice

1. Écrire `src/engine/exercises/monType.ts` exportant un `ExerciseRenderer`
   (`render` → poignée de saisie, `grade` → verdict, `statement` → le même
   énoncé sans saisie, pour le mode cahier ; ce dernier est facultatif, à
   défaut la consigne nue est affichée).
2. L'ajouter à `RENDERERS` dans `src/engine/exercises/index.ts`.

Rien d'autre ne bouge : ni le moteur, ni la session, ni l'interface.

## Hors-ligne et mises à jour

Deux stratégies de cache, volontairement distinctes :

- **coquille de l'application** (HTML, JS, CSS, polices, icônes) : précachée,
  servie cache-first. C'est ce qui permet d'ouvrir l'application en mode avion.
  316 Ko, dont 112 Ko de polices.
- **packs de contenu** (`/packs/*.json`) : stale-while-revalidate, dans un cache
  séparé (`carnet-packs`). Corriger une phrase d'exercice n'invalide donc pas
  tout le cache de l'application, et inversement.

Une nouvelle version ne s'installe **jamais** d'elle-même : le worker attend, et
l'accueil propose un bouton « Redémarrer ». Une session de révision ne peut pas
être interrompue par un rechargement surprise.

Le stockage persistant (`navigator.storage.persist()`) est demandé après une
session terminée, pas au chargement — et au plus une fois par jour tant qu'il
n'est pas accordé.

## Déploiement

```bash
npm run build           # -> dist/, à servir tel quel
```

Le déploiement est automatique : tout `git push` sur `main` déclenche
[deploy.yml](.github/workflows/deploy.yml), qui reconstruit et publie sur
GitHub Pages. Le préfixe d'URL est déduit du nom du dépôt, rien à régler.

Le dépôt s'appelle toujours `carnet`, et l'URL reste `/carnet/`. C'est
délibéré : renommer le dépôt changerait le *scope* du service worker et la PWA
déjà installée sur le téléphone pointerait vers une adresse morte. Le nom du
produit a changé, pas son adresse. Le cache d'exécution garde pour la même
raison son nom `carnet-packs`.

Pour reproduire ce build en local :

```bash
CARNET_BASE=/carnet/ npm run build
```

Un service worker exige un **contexte sécurisé** : `https://` ou `localhost`.
Une adresse de réseau local en `http://192.168.…` ne suffit pas — sur iPhone,
l'application se chargerait mais ne s'installerait pas et ne fonctionnerait pas
hors connexion.

## Ajouter un carnet (pack de contenu)

Écrire les sources dans `content/<id>/` (`pack.json` pour la méta et les
notions, un fichier par unité dans `units/`), lancer
`node scripts/build-pack.mjs <id>`, puis déclarer le carnet dans
`STATIC_CARNETS` (`src/carnets.ts`).

Le script valide contre `schemas/content-pack.schema.json`, puis vérifie ce
qu'un schéma ne voit pas : références croisées, doublons, phrases recyclées d'une
unité à l'autre, réponses à la fois acceptées et signalées comme fautes, trous
multiples. Il échoue bruyamment — un pack invalide n'atteint jamais `public/`.

`meta.locale` est la langue des consignes ; `meta.contentLocale`, facultatif,
celle de la matière — c'est celle qui est lue à voix haute.

Mettre à jour un pack est sûr : `syncPackCards` crée les cartes manquantes,
retire celles dont l'exercice a disparu, et laisse intact l'état FSRS du reste.
Un carnet qui ne se charge pas n'empêche pas les autres de s'ouvrir : l'accueil
le signale et la progression reste intacte.

## État d'avancement

| Étape | Statut |
| --- | --- |
| 1. Squelette — Dexie, FSRS, boucle de révision persistante | fait |
| 2. PWA réelle — manifest, service worker, meta iOS | fait, reste à valider sur iPhone et Android réels |
| 3. Contenu grammaire — 5 types d'exercice | en cours (68/145 unités, 544 exercices) |
| 4. Modes de réponse — écran, cahier, écoute | fait |
| 5. Rétention — export/import de sauvegarde | fait |
| 6. Direction artistique — palette, typographie, illustrations, mouvement | fait |
| 7. Discovery — vocabulaire saisi à la main | fait |
| 8. Culture — Bristol | amorcé (6 unités, 18 expressions) |
| 9. Série hebdomadaire, statistiques | à faire |

Deux points restent ouverts côté image : l'aquarelle de couverture, signée
Zayane, n'est pas embarquée — les illustrations sont des dessins vectoriels
originaux écrits dans son registre. L'intégrer supposerait son accord et un scan
à plat. Les photos du voyage ont nourri la palette sans être affichées.
