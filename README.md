# Go to Bristol

**L'anglais qu'il faut pour y être chez soi.**
En ligne : https://ar0698.github.io/carnet/

Quatre carnets, un seul moteur de mémoire. La grammaire pour la mécanique, le
vocabulaire pour les registres qu'on va vraiment parler, la culture pour la
ville, et Discovery pour les mots qu'on ramasse en chemin et qu'on note
soi-même. On y revient quelques minutes par jour ; l'application
décide seule de ce qui doit être revu et quand, pour que ce soit encore là dans
six mois.

PWA hors ligne, sans backend, sans compte. Le moteur ignore le sujet enseigné :
un domaine = un **pack de contenu**, ajouté sans toucher au code.

## Quatre carnets

| Carnet | Ce qu'on y travaille | D'où vient le contenu |
| --- | --- | --- |
| **Grammaire** | les 145 unités du livre, deux items d'exercices chacune | `public/packs/english-grammar.json` |
| **Vocabulaire** | 111 unités : les 100 chapitres d'*English Vocabulary in Use*, plus onze registres écrits pour ce voyage-ci | `public/packs/vocabulary.json` |
| **Culture** | Bristol racontée en anglais, et les mots qu'on y attrape | `public/packs/bristol-culture.json` |
| **Discovery** | le vocabulaire saisi à la main | IndexedDB, écrit par l'apprenante |

Chacun a sa propre file d'échéances, son propre quota de nouveautés et sa propre
progression. Rien ne se mélange entre carnets : réviser la grammaire ne fait pas
avancer le vocabulaire.

Un seul carnet pour les cent onze thèmes, et non un carnet par thème : chacun
aurait son propre quota de dix nouveautés par jour, si bien que dix carnets
autoriseraient cent nouvelles cartes quotidiennes — et le plafond de charge,
la meilleure idée de l'application, s'effondrerait. Les thèmes sont donc des
**notions** à l'intérieur d'un même carnet, et l'on dit « celui-ci d'abord » par
l'écran *Par où commencer*, pas en ouvrant un carnet de plus. Bénéfice
secondaire : le diagnostic par notion donne gratuitement la justesse par thème.

Un carnet qui n'a rien à revoir se replie sur une ligne. À quatre, des cartes
pleines transformeraient l'accueil en menu.

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

## Le compte à rebours

Une application de répétition espacée n'a pas de fin : elle propose ce qui est
dû, chaque jour, indéfiniment. C'est honnête, et c'est démoralisant. Le départ,
lui, a une date — et c'est la seule chose de l'accueil qui avance toute seule.

La carte en tête d'écran dit trois choses, et pas une de plus :

- **combien de jours il reste**, en gros, avec la part du chemin déjà faite ;
- **ce qu'il reste à ouvrir dedans** : les cartes encore fermées, divisées par
  les jours qui restent. « Il reste 1 223 cartes à ouvrir et 365 jours pour le
  faire : 4 par jour suffisent » ;
- **si le compte tombe juste.** Quand le rythme nécessaire dépasse le plafond de
  dix nouveautés par carnet et par jour, la carte le dit : la date tiendra, le
  programme entier non, et c'est l'ordre d'ouverture qui décidera de ce qu'on
  saura. C'est le seul endroit de l'application qui puisse contredire
  l'apprenante, et c'est pour ça qu'il existe.

La date est **modifiable** — personne ne part exactement un an après avoir
installé une application. À défaut, le compteur s'arme au premier lancement pour
365 jours, parce qu'un compteur qui attend d'être réglé à la main ne démarre
jamais.

Deux détails qui auraient faussé le compte :

- **On compte des jours, pas des heures.** Deux fois par an, le passage à
  l'heure d'été fait qu'un « jour » dure 23 ou 25 heures ; une division sèche
  rendrait 364,96 et le compteur perdrait un jour un matin de mars, sans raison
  visible. `daysBetween` arrondit, et compare des minuits locaux.
- **Les dates traversent le `kv` en texte.** Le `kv` est exporté et réimporté
  tel quel par la sauvegarde, sans réveil des dates : une `Date` y partirait en
  texte et reviendrait en texte, sans que rien ne le signale. On stocke donc
  deux chaînes ISO, et `parseDateInput` relit la valeur du champ comme une date
  **locale** — `new Date('2027-08-03')` serait lue en UTC et reculerait d'un
  jour à l'ouest de Greenwich.

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

## Vocabulaire — cent unités, et trois façons de découvrir un mot

Les cent chapitres d'*English Vocabulary in Use*, en dix-huit sections, huit
cents mots. Chacun porte son sens, une phrase où quelqu'un le dirait vraiment,
et les fautes qu'un francophone va commettre dessus. S'y ajoutent les onze
registres écrits pour ce voyage-ci — le bureau, la tech, la scène, le pub — qui
ouvrent en premier parce qu'ils sont les plus urgents.

**Produire un mot depuis le français ne suffit pas à le connaître.** Traduire dit
ce qu'un mot veut dire ; ça ne dit ni où il s'arrête, ni à quoi il ressemble, ni
avec qui il vit. D'où trois types d'exercice de plus :

| Type | Ce qu'il demande | Pourquoi il existe |
| --- | --- | --- |
| `match` | relier quatre ou cinq mots à leur sens | Le premier contact, et le seul exercice conçu pour être **facile** : une carte neuve qui ne peut qu'échouer n'apprend rien. On y décide, donc on s'y engage — et les mots d'une même famille se voient ensemble. |
| `picture` | nommer un dessin | Le seul exercice qui ne passe pas par le français. Un mot appris par sa traduction s'atteint en deux temps, et le maillon du milieu lâche exactement quand on parle. |
| `odd_one_out` | écarter l'intrus d'une famille | `a stew`, `a casserole` et `a roast` sont des façons de cuire, `a kettle` non. C'est en l'écartant qu'on découvre la frontière du groupe. |

L'appariement arrive **avant** les mots de son unité et l'intrus **après** : cela
tient à l'identifiant de leurs items (`<unité>-0-match`, `<unité>-1-<mot>`,
`<unité>-2-odd`), puisque `newCards()` ouvre le neuf par ordre d'item. La
découverte d'abord, la production ensuite, la frontière à la fin — et le moteur
n'a pas eu à connaître l'existence de ces types.

**Les dessins sont vectoriels et originaux** (`src/ui/vocabArt.ts`), dans le
registre de l'aquarelle comme le reste. Quatre-vingts d'entre eux, quelques
centaines d'octets chacun, nets à toutes les tailles et disponibles en mode
avion. Ils ne sont pas jolis, ils sont **reconnaissables** — trois traits et le
mot arrive ; le cordon, le bouton et le reflet donneraient une plus belle
bouilloire et un moins bon exercice.

### Le compilateur de vocabulaire

Un exercice de grammaire est un cas d'espèce : la phrase à transformer et
l'explication qui va avec ne se déduisent de rien. Un mot, lui, est régulier — le
mot, son sens, une phrase où il vit — et les exercices qu'on en tire sont
toujours les mêmes. Les écrire à la main huit cents fois produirait le même pack
avec quarante fois plus d'endroits où se tromper.

Le vocabulaire s'écrit donc **un mot par ligne** dans `content/vocabulary/words/`,
et `scripts/vocab-words.mjs` en tire les exercices :

```json
{ "en": "a kettle", "fr": "une bouilloire",
  "eg": "Stick the {kettle} on, I'm parched.", "art": "kettle" }
```

Les accolades marquent le trou : c'est la forme fléchie du mot dans *cette*
phrase-là, qui n'est presque jamais celle du dictionnaire. Trois choses sont
fabriquées plutôt qu'écrites, parce que les écrire n'apporterait rien : les
distracteurs du filet de secours, pris chez les mots voisins de l'unité ;
l'appariement de découverte ; et l'indice du dessin — première lettre et nombre
de lettres, jamais le sens français, qui rendrait au mot le détour que le dessin
sert à lui éviter.

Cinq garde-fous s'ajoutent à l'assemblage : un mot enseigné par deux unités, un
dessin partagé par deux mots, une phrase d'exemple recyclée, un intrus qui
appartient à sa propre famille, un `art` qui ne mène à aucun dessin.

## Welcome to the workplace — l'anglais du bureau

Sept registres, cinquante-six expressions, cent soixante-huit exercices, écrits
pour quelqu'un qui part encadrer une équipe en Angleterre. Les exemples sont
tirés du même monde d'un bout à l'autre : un pilote d'IA, une migration, un
comité de pilotage, un plateau qu'on réaménage.

| Registre | Ce qu'on y apprend |
| --- | --- |
| Arriver dans la boîte | `line manager`, `a direct report`, `to be across something`, `to crack on`, `a quick word` |
| En réunion | `to touch base`, `to park it`, `low-hanging fruit`, `a ballpark figure`, `to have the bandwidth` |
| Ce qu'ils disent, ce qu'ils pensent | la litote britannique : `I hear what you say`, `quite good`, `a brave decision` |
| Mails et messages | `to loop someone in`, `by close of play`, `bear with me`, `as per my last email` |
| La mission et le client | `a statement of work`, `scope creep`, `to sign off`, `a day rate`, `to push back` |
| L'IA au bureau | `a human in the loop`, `guardrails`, `to hallucinate`, `to productionise`, `shadow AI` |
| Bureaux et hybride | `hot-desking`, `the estate`, `a rollout`, `adoption`, `to bed in`, `presenteeism` |

**Le registre de la litote mérite son propre groupe.** C'est là qu'un cadre
francophone se fait avoir, et jamais sur le vocabulaire technique : `I hear what
you say` ferme la discussion, `quite good` est une déception, `just a few minor
comments` veut dire que c'est à refaire, et `that's a very brave decision`
signale qu'on court à la catastrophe. Ces items portent un `fields.passage` —
le même champ que le carnet Culture — qui montre l'expression dans un
mini-dialogue, après la réponse : la formule seule ne dit rien, c'est
l'enchaînement qui la trahit.

Les fautes anticipées visent les calques du français, parce que ce sont eux qui
reviennent : `my responsible` pour `my line manager`, `an estimation` pour
`a ballpark figure`, `to validate` pour `to sign off`, `appropriation` pour
`adoption`, et `flex office` — une invention française que personne n'emploie
au Royaume-Uni.

**Pourquoi sept groupes dans le carnet Vocabulaire et non un huitième carnet.**
Chaque carnet a son propre quota de dix nouveautés par jour : un carnet de plus,
ce sont dix nouvelles cartes quotidiennes de plus à porter, et le plafond de
charge — la meilleure idée de l'application — s'effrite d'autant. Le levier
prévu pour dire « le bureau d'abord » existe déjà : l'écran *Par où commencer*,
où l'on coche les sept groupes `Workplace`, qui s'ouvrent alors avant le pub et
la scène. L'ordre des découvertes appartient à l'apprenante ; ce n'est pas une
raison pour lui ouvrir dix cartes de plus par jour.

*(Le module s'appelle « Welcome **to** the workplace ». `Welcome in` est un
calque du français : en anglais on souhaite la bienvenue **to** un lieu.)*

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
mot, explication de l'erreur quand elle est prévue dans le contenu.

Ce qui distingue une réponse venue toute seule d'une réponse arrachée, c'est le
délai jusqu'à la **première frappe**, pas le temps total. La différence n'est pas
cosmétique : mesuré sur les 476 cartes de grammaire d'alors, le temps total rendait la
mention « facile » inatteignable pour **69 %** d'entre elles — 4 % pour les
exercices de production contre 98 % pour les textes à trou. La note ne mesurait
plus la mémoire mais la longueur de la réponse, et pénalisait exactement les
exercices les plus exigeants. Voir `Answer.recallMs`.

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

## Où ça coince

Le journal des réponses enregistrait depuis le premier jour la carte, la note,
la justesse et la durée — et n'était jamais relu. C'est pourtant exactement la
matière qui répond à « je fais des fautes quelque part, mais où ? ».

L'écran montre trois choses : les notions qui résistent, celles qui tiennent, et
les cartes qui ne rentrent décidément pas. Deux garde-fous le rendent honnête :

- **Quatre réponses minimum** avant de juger une notion. Trois réponses ne
  distinguent pas une lacune d'un mauvais jour.
- **La tendance avant le taux.** Une notion à 55 % qui est passée de 20 à 90 %
  n'est pas un point faible, c'est l'inverse. Sans cette lecture en deux moitiés
  chronologiques, l'écran désignerait comme fragiles les notions justement en
  train d'être acquises.

**Il n'y a délibérément aucun bouton « travailler cette notion ».** Filtrer une
session sur une notion unique, c'est de la pratique en bloc — exactement ce que
l'accueil dit combattre. Le planificateur fait déjà le travail : une carte ratée
revient plus tôt et plus souvent, donc une notion faible occupe naturellement la
file. Ce qui manquait n'était pas le mécanisme, c'était la confiance dans le
mécanisme.

Ce qui appartient en revanche à l'apprenante, c'est **l'ordre dans lequel le
neuf s'ouvre** — pas l'ordre des révisions. C'est l'objet de l'écran *Par où
commencer*, accessible depuis chaque carnet qui a encore des notions fermées :
on y coche des groupes, et `newCards()` les sert en premier. Avec 2 030 cartes en
réserve dans la seule grammaire — plus de deux cents jours de nouveautés — cet
ordre change vraiment ce qu'on sait dans un mois.

La distinction tient en une phrase : **l'ordre des révisions appartient au
planificateur, l'ordre des découvertes appartient à l'apprenante.** Le réglage
ne filtre aucune session, ne rappelle rien plus tôt, et ne touche pas au plafond
de dix nouveautés par jour.

**Les cartes-sangsues.** Au-delà de quatre rechutes, l'état FSRS ne décrit plus
une mémoire mais une série d'échecs, et la carte revient sans fin à un jour
d'intervalle. `resetCard` la remet à neuf et rouvre la porte de graduation ; le
journal, lui, est conservé — ce qui a eu lieu a eu lieu.

## Le cours — l'endroit où on va comprendre

Une fiche par unité : l'image mentale, la règle en une phrase, le contraste avec
la règle voisine, le piège du francophone, et deux phrases qu'on pourrait
vraiment dire — une dans la ville, une au bureau. Le tout sur un seul écran,
sans rien de repliable. C'est la contrainte de départ : on vient y chercher une
réponse en quelques secondes, pas un chapitre.

Les règles de temps portent en plus une **frise** : les durées, les instants, et
le repère « maintenant » toujours au milieu. Le passé à gauche, l'avenir à
droite, dans les 145 fiches — un axe qui se réorganise d'une unité à l'autre
obligerait à le relire avant de lire la règle. Ce n'est pas une décoration : ce
qui est vu en même temps que lu se retrouve par deux chemins au lieu d'un.

**Les 111 fiches du vocabulaire ont deux blocs de plus**, et ce sont eux qui
répondent à « pourquoi ce mot-là, à ce moment-là » :

- **la scène** — cinq ou six mots de l'unité tenus dans le même paragraphe
  anglais, avec leur glossaire *sous* le texte et jamais entre parenthèses
  dedans : un sens posé à côté du mot se lit à sa place, et la phrase anglaise
  n'est alors jamais lue. Un mot appris seul se range dans une case vide ; on
  sait le traduire et on ne sait pas quand le dire ;
- **l'échelle** — ce que la frise du temps est à la grammaire. Beaucoup de mots
  ne se distinguent pas par leur sens mais par leur degré : `drizzle`,
  `a shower`, `a downpour` disent tous la pluie. Alignés sur un axe gradué, ils
  se rangent d'un coup d'œil ; définis un par un, ils restent trois synonymes.

L'assemblage refuse une scène qui reprend telle quelle la phrase d'un exercice
de sa propre unité — le texte à trou s'ouvrirait déjà rempli. Deux contextes
différents pour le même mot valent mieux qu'un seul répété : la contrainte
améliore le contenu au lieu de le brider.

**Le cours se choisit depuis son carnet.** Chaque carte d'accueil porte son lien
et son compte de fiches ; l'écran du cours a ses onglets. Le lien reste sur la
dernière ligne de la carte, à côté de *Par où commencer*, et jamais parmi les
boutons de durée — pour la raison énoncée plus bas, qui n'a pas changé.

**Le cours s'ouvre depuis une faute.** Après une réponse fausse — et seulement
après, jamais avant — un lien « Comprendre cette règle » ouvre la fiche
par-dessus la session. La file de révision reste derrière, intacte. C'est le
moment où cette fiche vaut mieux qu'un exercice de plus : une erreur sur
laquelle on s'était engagé, corrigée dans la foulée, tient mieux que la même
règle lue sans s'être trompé.

**Et il n'est jamais sur le chemin le plus court.** Il vit en pied d'accueil,
avec le diagnostic et la sauvegarde, jamais à côté des boutons de session. Il ne
produit aucune carte, ne déplace aucune échéance, ne compte dans aucune
statistique. Relire donne le sentiment très net de savoir, et ce sentiment ne
prédit pas ce dont on se souviendra la semaine suivante ; une porte « lire la
règle » aussi visible que « réviser 15 minutes » serait prise chaque fois que la
session fait peur. Le raisonnement complet, et l'audit du reste de
l'application, sont dans [`docs/audit-apprentissage.md`](docs/audit-apprentissage.md).

Les fiches vivent dans `content/<pack>/lessons/`, un fichier par groupe, et sont
raccrochées à leur notion au moment de l'assemblage. **Les 145 de grammaire et
les 111 de vocabulaire sont écrites.** Le champ reste facultatif pour autant :
une unité peut avoir ses exercices sans avoir sa fiche, et l'accès n'apparaît que
là où il y a quelque chose à lire — c'est ce qui permettra d'en ajouter à Culture
sans rien changer au code.

L'assemblage refuse une fiche qui renvoie à une unité inexistante, qui n'a pas
ses deux registres, ou dont un exemple reprend mot pour mot la réponse attendue
par un exercice de la même unité — auquel cas ouvrir la fiche donnerait la
réponse au lieu de la faire chercher.

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
voyage — papier grainé et encre brune du dessin, bleu pétrole du port, jaune des
montgolfières, brique de Stokes Croft, vert des parcs. Les noms disent le rôle
et l'origine : `--harbour` porte les actions, `--brick` les erreurs, `--park`
les réussites, `--balloon` les mises en garde.

Les teintes d'illustration sont relevées une par une sur le dessin, et ne
servent qu'à lui : les fuseaux prune et bleu nuit des ballons, l'ocre des
pylônes et l'ambre des câbles, et la rangée de maisons — orange, sarcelle, rose,
jaune. Une rangée de quatre maisons de la même couleur ne serait pas
Cliftonwood, ce serait un lotissement.

Les illustrations (`src/ui/art.ts`) sont **vectorielles et originales**, écrites
dans le registre de l'aquarelle : lavis qui bavent — un `feTurbulence` déplacé,
seul moyen honnête d'obtenir un bord de pinceau sans texture bitmap — et trait
d'encre par-dessus. Elles pèsent quelques kilo-octets, restent nettes à toutes
les tailles et fonctionnent en mode avion. Une photo nette à côté d'une
aquarelle, l'un des deux perd toujours.

Trois choses que le dessin a apprises en cours de route, et qu'un aplat unique
perdrait :

- **Le papier reste nu.** Un grand lavis de ciel et deux aplats de sol rendaient
  toute la bannière terne. Sur l'aquarelle de couverture, c'est le blanc du
  papier qui fait chanter les couleurs ; il ne reste donc qu'un lavis d'herbe,
  juste sous les maisons.
- **Les fuseaux sont de vraies bandes**, détourées par l'enveloppe du ballon.
  La même forme rétrécie donne une lentille centrale, jamais les quartiers d'un
  ballon — et chaque `clipPath` porte son index, sans quoi les trois ballons
  partageraient le premier détourage.
- **L'ordre fait la profondeur.** Le pont d'abord, la rangée de maisons
  par-dessus. Dessinée avant, la plus haute se faisait trancher le toit par le
  tablier : deux plans à la même distance, et le dessin s'aplatit.

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

### Ce que la mesure a corrigé

Les deux niveaux d'encre atténuée et le vert des réussites étaient réglés à
l'œil. Mesurés, ils ne passaient pas :

| Ce qui était réglé à l'œil | Mesuré | Corrigé à |
| --- | --- | --- |
| `--ink-faint` à 38 %, sous les mentions en petites capitales posées sur un aplat teinté | **2,2:1** | 68 % → 4,9:1 |
| `--ink-soft` à 62 %, sur un aplat teinté | 4,1:1 | 78 % → 6,2:1 |
| `--park` #5c8a3f, pour le mot manquant d'une correction | 4,1:1 | #517a37 → 5,0:1 |

La hiérarchie ne se fait donc pas en délavant le texte mais par la casse et le
corps. Trois zones tactiles étaient également sous le minimum de 44 px : les
liens de l'accueil (23 px — et ce sont les seuls accès à *Par où commencer*, *Où
ça coince* et *Sauvegarder mes données*), le dépliant *Comment ça tient en
mémoire* (39 px), et le champ du texte à trou (37 px), qui est pourtant la
saisie la plus fréquente de l'application.

## Démarrer

```bash
npm install
npm run dev
```

| Script | Effet |
| --- | --- |
| `npm run dev` | serveur de développement (http://localhost:5173) |
| `npm run build` | packs, typecheck, tests, puis build statique dans `dist/` |
| `npm test` | la suite de tests (vitest) |
| `npm run test:watch` | les tests en continu pendant qu'on code |
| `npm run pack` | reconstruit les trois packs de contenu |
| `npm run typecheck` | typecheck seul |
| `npm run preview` | sert le build de production (http://localhost:4173) |
| `npm run icons` | régénère les icônes depuis `scripts/make-icons.mjs` |

Le service worker n'est actif que sur le build de production : pour tester
l'installation ou le hors-ligne, passer par `npm run build && npm run preview`,
jamais par `npm run dev`.

## Structure

```
src/
  carnets.ts            racine de composition : ouvre les quatre carnets
  engine/
    scheduler.ts        enveloppe ts-fsrs + porte de graduation
    grading.ts          correction normalisée (tolérante sur la forme, stricte sur le sens)
    insights.ts         agrégation du journal : notions fragiles, cartes-sangsues
    session.ts          composition de la session, quota de nouveautés, persistance
    exercises/          un fichier par type d'exercice + registre
  storage/
    countdown.ts        le compte à rebours : jours restants, date de départ
    db.ts               schéma Dexie versionné (cards / reviews / kv / vocab)
    cards.ts            synchronisation pack → cartes, requêtes de sélection
    vocab.ts            carnet Discovery : stockage et vue « pack »
    backup.ts           export / import de sauvegarde
    disputes.ts         formulations refusées à tort, à porter au contenu
    prefs.ts            réglages de session (mode cahier)
    priorities.ts       groupes à ouvrir en premier, par carnet
  test/
    setup.ts            IndexedDB en mémoire, installé avant tout import
    helpers.ts          fabriques minimales de packs et de cartes
  packs/
    schema.ts           types du pack de contenu (dont la fiche de cours)
    validate.ts         validation au chargement
    index.ts            chargement (fetch de /packs/<id>.json)
  ui/
    tokens.css          design tokens — seule source des couleurs et des rythmes
    fonts.css           faces auto-hébergées, sous-ensemble latin
    art.ts              illustrations vectorielles
    vocabArt.ts         les quatre-vingts dessins du vocabulaire
    lesson.ts           la fiche de cours : frise du temps, rendu, fenêtre modale
    app.css             styles
    speech.ts           lecture à voix haute (speechSynthesis)
    screens/            accueil, révision, bilan, vocabulaire, diagnostic,
                        ordre de découverte, sauvegarde, cours
content/<pack>/
  units/                exercices écrits à la main, un fichier par groupe
  words/                vocabulaire, un mot par ligne — compilé en exercices
  lessons/              fiches de cours, un fichier par groupe thématique
public/packs/           packs assemblés, servis en statique
scripts/
  build-pack.mjs        assemblage et validations
  vocab-words.mjs       le compilateur de vocabulaire
```

## Trois idées à connaître avant de toucher au code

**Une carte = un exercice.** Chaque exercice d'un item porte son propre état
FSRS, sous l'identifiant `packId:itemId:index`. Réviser un item ne fait pas
avancer mécaniquement tous ses exercices. L'ordre des exercices d'un mot
Discovery est donc un contrat : la production reste en tête, le choix multiple
en queue, pour qu'apparaître ou disparaître ne décale jamais un identifiant.

**La porte de graduation, et ce qu'elle coûte.** Une carte ne part en révision
longue qu'après deux réussites sur des jours *différents*, dont au moins une en
session mélangée (≥ 2 notions). Tant que la porte n'est pas franchie, l'échéance
est plafonnée à 24 h. Voir `spacedSuccesses` et `interleavedSuccess` sur
`CardRecord`.

Le code n'écrit jamais `stability` ni `difficulty` — mais il serait faux d'en
conclure que le plafond est gratuit. Simulation d'une carte répondue *Good* à
chaque échéance :

| Révision | Sans porte | Avec porte |
| --- | --- | --- |
| 2 | 2 j | **1 j** (plafonnée) |
| 3 | 11 j | 7 j |
| 4 | 46 j | 32 j |
| 6 | 498 j | 374 j |

Réviser en avance donne une rétrievabilité plus haute, donc un gain de stabilité
plus faible, et l'écart ne se rattrape pas : **toute l'échelle est rabaissée
d'environ un quart, définitivement**. C'est-à-dire près de 30 % de révisions en
plus sur un an, en échange d'un espacement garanti sur des jours différents.

L'échange est assumé — l'espacement inter-journalier est l'un des résultats les
mieux établis de la littérature — mais c'est un échange, pas un repas gratuit.

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

## Ce que les tests garantissent

`npm test` — 59 cas, moins d'une seconde. Ils ne cherchent pas la couverture :
ils tiennent les cinq endroits où une erreur détruit des données sans rien
signaler.

**L'élagage sélectif.** Qu'un pack personnel vide n'emporte aucune carte, et
qu'il continue pourtant de créer les manquantes.

**La réconciliation du vocabulaire.** Qu'effacer une phrase d'exemple retire le
texte à trou et lui seul ; que supprimer un mot emporte ses cartes et ses
réponses, et rien d'autre.

**Le réveil des dates à l'import.** Le test vérifie d'abord que le problème est
réel — dans le fichier, `due` est bien une chaîne — puis que la relecture rend
de vrais `Date`. Sans cela les échéances se compareraient en ordre alphabétique,
sans jamais lever d'erreur.

**La porte de graduation.** Que deux réussites le même jour ne comptent que pour
une, qu'une session non mélangée ne l'ouvre pas, qu'un échec la rouvre sans
redemander l'entrelacement déjà acquis.

**Le contenu plus récent que le code.** Qu'un pack contenant un type d'exercice
inconnu se charge quand même, que cet exercice ne reçoive pas de carte, et
surtout que **l'index de ses voisins ne bouge pas** — filtrer le tableau au lieu
de sauter l'exercice donnerait la carte `v:i1:1` à une question que la version
suivante numérotera `v:i1:2`, et l'historique de révision de l'une se
retrouverait collé à l'autre.

Ces tests ont été vérifiés par mutation : casser l'option `prune` fait tomber
exactement les deux cas qui la protègent, retirer le réveil des dates en fait
tomber trois, et retirer le contrôle de type en fait tomber trois autres. Un test
qui ne peut pas échouer ne garantit rien.

`npm run build` les exécute : une garantie cassée ne peut pas partir en ligne.

## Hors-ligne et mises à jour

Deux stratégies de cache, volontairement distinctes :

- **coquille de l'application** (HTML, JS, CSS, polices, icônes) : précachée,
  servie cache-first. C'est ce qui permet d'ouvrir l'application en mode avion.
  334 Ko, dont 112 Ko de polices.
- **packs de contenu** (`/packs/*.json`) : network-first avec trois secondes de
  patience, dans un cache séparé (`carnet-packs`). Corriger une phrase
  d'exercice n'invalide donc pas tout le cache de l'application, et inversement.

Une nouvelle version ne s'installe **jamais** d'elle-même : le worker attend, et
l'accueil propose un bouton « Redémarrer ». Une session de révision ne peut pas
être interrompue par un rechargement surprise.

### Ce qui a coûté deux jours de contenu invisible

Les packs étaient en stale-while-revalidate — la copie en cache part tout de
suite, la nouvelle est téléchargée *pour la fois d'après*. Bon compromis pour une
image, mauvais pour du contenu enseigné : cent unités publiées un lundi
n'apparaissaient qu'au deuxième lancement. Et il n'y avait pas de deuxième
lancement, parce qu'**une PWA installée sur iOS n'est pas relancée quand on y
revient** : le processus est gardé en vie et `boot()` ne rejoue pas. Trois
corrections, qui tiennent ensemble :

- les packs passent en **network-first** : en ligne on voit le contenu du jour,
  hors ligne on retombe sur le cache sans attendre. Un pack inchangé revient en
  304 sans corps, donc le coût réel est un aller-retour, pas 900 Ko ;
- ils sont **relus au retour au premier plan** (`refreshStaticCarnets`), depuis
  l'accueil seulement, et l'écran n'est redessiné que si quelque chose a bougé —
  recharger un pack au milieu d'une session déplacerait les cartes sous les
  doigts. La comparaison porte sur version + nombre de notions + nombre d'items,
  parce qu'on oublie d'incrémenter la version, et que le jour où on l'oublie est
  celui où l'on a ajouté cent unités ;
- **un type d'exercice inconnu ne fait plus refuser le carnet.** C'est le point
  le plus important, et il est structurel : les packs se relisent à chaque
  lancement, le code attend « Redémarrer », il existe donc toujours une fenêtre
  où du contenu neuf rencontre du code ancien, et elle s'ouvre à chaque type
  ajouté. `validatePack` y voyait une corruption et refusait cent onze unités
  pour trois exercices. Un type inconnu est désormais simplement privé de carte
  (`isScheduled`) : sans carte, une session ne peut pas le tirer. La barrière
  d'incompatibilité redevient `meta.schemaVersion`, qui dit que la *structure* a
  changé — pas le catalogue des types.

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
| 3. Contenu grammaire — 5 types d'exercice | fait (145/145 unités, deux items chacune, 2 320 exercices) |
| 4. Modes de réponse — écran, cahier, écoute | fait |
| 5. Rétention — export/import de sauvegarde | fait |
| 6. Direction artistique — sérigraphie, pochoir, tirage de nuit | fait |
| 7. Discovery — vocabulaire saisi à la main | fait |
| 8. Culture — Bristol | amorcé (6 unités, 18 expressions) |
| 9. Diagnostic — notions fragiles, cartes-sangsues, contestations | fait |
| 10. Tests sur les chemins de données | fait |
| 11. Vocabulaire thématique — 11 registres, 88 expressions | fait |
| 12. Ordre de découverte choisi par groupe | fait |
| 13. Module Workplace — 7 registres, 56 expressions | fait |
| 14. Compte à rebours — jours restants, cartes restantes, rythme exigé | fait |
| 15. Vocabulaire complet — 100 unités, 800 mots, 2 925 exercices | fait |
| 16. Trois types d'exercice : appariement, dessin, intrus | fait |
| 17. Cours du vocabulaire — 111 fiches, scène et échelle | fait |
| 18. Série hebdomadaire | à faire |

Un point reste ouvert côté image : l'aquarelle de couverture, signée Zayane,
n'est pas embarquée — les illustrations sont des dessins vectoriels originaux
écrits dans son registre. L'intégrer supposerait son accord et un scan à plat.
Les photos du voyage ont nourri la palette sans être affichées.
