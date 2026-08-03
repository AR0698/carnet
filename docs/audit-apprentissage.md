# Audit — ce que l'application fait à la mémoire

Relecture de l'application entière à la lumière de ce qu'on sait de
l'apprentissage, et justification de la section **Cours** ajoutée par-dessus.
Écrit pour être relu dans six mois, quand la tentation sera de rendre les
choses plus confortables.

Trois questions, dans cet ordre : ce qui tient déjà, ce qui manquait, et ce que
le cours risque de casser s'il est mal placé.

---

## 1. Ce qui tient déjà

Sept décisions du moteur, vérifiées une par une. Aucune n'est à changer.

| Décision | Ce qui la soutient |
| --- | --- |
| Répondre de mémoire, jamais relire d'abord | L'effet de test : récupérer un souvenir le renforce bien plus que le relire. C'est le résultat le plus solide et le plus reproduit du domaine. |
| Espacer, et allonger tant que ça passe | L'effet d'espacement. FSRS-6 ne fait qu'automatiser un choix d'intervalle qu'on ferait mal à la main. |
| **La porte de graduation** — deux réussites des jours *différents*, dont une en session mélangée | La meilleure idée de l'application, et la moins courante. Deux réussites le même jour ne prouvent qu'une mémoire de travail encore chaude. Exiger un jour de sommeil entre les deux, c'est refuser la preuve la plus facile. |
| Mélanger les notions dans une session | L'entrelacement : de moins bons résultats sur le moment, de bien meilleurs une semaine après. C'est un troc, et l'application l'a fait dans le bon sens. |
| Plafonner à dix nouveautés par carnet et par jour | Ouvrir soixante notions un dimanche, c'est soixante révisions à porter tous les jours suivants. Le plafond protège des lendemains. |
| En mode cahier : « sans hésiter » / « en cherchant » / « non » | La latence de récupération est un meilleur indice de solidité que la seule justesse. Une réponse arrachée n'est pas une réponse acquise, et le planificateur a besoin de le savoir. |
| Le compte à rebours qui annonce que le compte ne tombe pas juste | Le seul endroit de l'application qui puisse contredire l'apprenante. Un plan qui ne tient pas et qu'on ne dit pas est un plan qu'on découvre trop tard. |

Un point mérite d'être souligné parce qu'il est contre-intuitif et qu'il a été
tenu : **l'écran « Où ça coince » ne propose aucun bouton « travailler cette
notion »**. C'est exactement juste. Filtrer une session sur une notion faible,
c'est de la pratique en bloc — d'excellents résultats dans l'heure, rien la
semaine suivante. La tentation reviendra ; elle doit être refusée à nouveau.

---

## 2. Ce qui manquait : le moment de la faute

C'est le seul vrai trou trouvé, et il était au pire endroit.

En mode écran, après une réponse fausse, l'application affichait la comparaison
mot à mot, la réponse attendue, la prochaine échéance — et l'explication de la
faute **seulement si une erreur anticipée (`pitfall`) correspondait**. Sinon :
rien. Pas de règle, pas de pourquoi. L'indice existait bien, mais il n'était
atteignable qu'**avant** de répondre, par le bouton « Un indice ».

Or c'est précisément là que se joue le plus gros bénéfice disponible : une
erreur qu'on vient de commettre, sur laquelle on s'était engagé, et qui est
corrigée dans la foulée, se retient mieux que la même règle lue sans s'être
trompé. Se tromper avec conviction puis recevoir la correction est un des rares
cas où l'erreur est un gain. L'application produisait ce moment plusieurs fois
par session et n'en faisait rien.

**Ce qui a été ajouté** : un lien « Comprendre cette règle », qui n'apparaît
qu'après la réponse, et seulement quand elle est fausse. Il ouvre la fiche de
l'unité par-dessus la session — la file de révision reste derrière, intacte, et
rien de ce qui est lu ne déplace la moindre carte.

Les trois contraintes de cette intégration, dans l'ordre d'importance :

1. **Jamais avant la réponse.** La règle sous les yeux au moment de produire
   transforme un rappel en recopie, et le bénéfice de l'effort disparaît avec.
2. **Jamais un écran de plus.** Sortir de la session pour lire ferait de la
   consultation une interruption, quand elle doit être un coup d'œil. D'où une
   fenêtre modale et non une navigation.
3. **Aucune récompense.** Lire ne fait rien avancer, et l'écran le dit en
   toutes lettres.

---

## 3. Ce que le cours risquait de casser

Ajouter une section « aller comprendre » à une application de mémorisation est
un piège connu, et il fallait le désamorcer avant d'écrire la première fiche.

**Le risque principal : l'illusion de fluence.** Relire est facile, ça donne le
sentiment très net de savoir, et ce sentiment ne prédit pas ce dont on se
souviendra la semaine suivante. Pire : mis en situation de choisir, on préfère
massivement relire plutôt que se tester — et on choisit la méthode qui perd. Une
porte « lire la règle » aussi visible que « réviser 15 minutes » serait prise
chaque fois que la session fait peur.

**Les trois garde-fous retenus :**

- Le cours vit **en pied d'accueil**, avec le diagnostic et la sauvegarde,
  jamais à côté des boutons de session. Ce n'est pas de la timidité de mise en
  page, c'est la mesure de protection principale.
- Il ne produit **aucune carte**, ne déplace **aucune échéance**, ne compte dans
  **aucune statistique**. Il n'y a rien à gagner à y aller, donc rien à
  détourner.
- Depuis une session, il n'est atteignable **qu'après une faute**.

**Le risque secondaire : la surcharge.** Une fiche qui déborde n'est plus une
réponse rapide, c'est un chapitre. D'où la contrainte dure : une fiche tient sur
un écran, dans un ordre fixe, sans rien de repliable. Un accordéon obligerait à
décider quoi ouvrir avant de savoir ce qu'il y a dedans.

---

## 4. La fiche, champ par champ

L'ordre de lecture n'est pas décoratif : on retient un cas concret bien avant
une formulation abstraite, et la formulation placée en tête ne s'accroche à
rien.

| Champ | Ce qu'il fait, et pourquoi il est là |
| --- | --- |
| **`image`** | Une phrase concrète, un peu bête, qui se voit. « Le sol est trempé : il a plu. » C'est ce qui reste quand la formulation s'efface. Écrite à la main dans l'interface, littéralement — la police manuscrite signale que ça se raconte, ça ne se récite pas. |
| **`figure`** | Le schéma du temps : durées, instants, et le repère « maintenant » toujours au milieu. Une règle de temps grammatical se voit sur un axe plus vite qu'elle ne se lit, et ce qui est vu **en même temps que** lu se retrouve par deux chemins au lieu d'un. Le repère ne bouge jamais d'une fiche à l'autre : un axe qui se réorganise oblige à le relire avant de lire la règle. |
| **`rule`** | La règle en une phrase, en forme d'équation quand c'est possible. Elle arrive **après** l'image, jamais avant. |
| **`contrast`** | Les deux formes que l'unité sert à distinguer. On se trompe rarement sur une règle isolée : presque toujours entre deux règles voisines. C'est aussi pour ça que les renvois « à ne pas confondre avec » se suivent sans fermer la fenêtre. |
| **`trap`** | La faute du francophone, nommée comme telle, avec la phrase fautive barrée à côté de la bonne. Nommer la source de l'erreur — « le français dit *depuis* pour les deux » — est ce qui la rend repérable la fois suivante. Une faute qu'on ne sait pas voir ne se corrige pas. |
| **`examples`** | Deux registres imposés par la validation : la ville et le travail. Une règle rencontrée dans un seul contexte se reconnaît dans ce seul contexte ; c'est la variété des exemples qui rend l'usage transférable. |

### Sur Fabien Olicard, et ce qu'on lui prend vraiment

Ce qu'il préconise et qui s'applique ici : la mémoire fonctionne par
**association**, par **image**, et retient mieux ce qui est **absurde,
exagéré ou chargé d'émotion**. C'est exactement le rôle du champ `image` — et
c'est pour ça qu'il est écrit en langue parlée plutôt qu'en style de manuel.

Ce qu'il préconise et qu'on **n'applique pas**, délibérément : le **palais
mental** et la **table de rappel**. Ces techniques sont faites pour des listes
arbitraires et ordonnées — des chiffres, des prénoms, un ordre de cartes. Une
règle de grammaire n'est pas une liste arbitraire : c'est un système avec des
contrastes et des raisons. Y plaquer un palais ajouterait une couche à
mémoriser par-dessus ce qu'on veut apprendre, et ferait payer deux fois. La
partie utile de sa méthode ici, c'est l'image concrète ; pas l'architecture.

---

## 5. Ce qui reste faible

Constats honnêtes, par ordre de valeur.

1. **120 unités sur 145 n'ont pas encore de fiche.** Le lien « Comprendre cette
   règle » n'apparaît que là où il mène quelque part — donc, pour l'instant, sur
   les 25 premières. Le trou du § 2 reste ouvert partout ailleurs.
2. **Rien ne demande jamais de reformuler une règle avec ses mots.**
   S'expliquer à soi-même est la technique la plus rentable qui manque
   aujourd'hui à l'application. Ce serait un type d'exercice, pas une fiche.
3. **En mode écran, l'indice n'est toujours pas montré après une faute** quand
   aucune erreur anticipée ne correspond. Le mode cahier, lui, le fait. La fiche
   comble ce trou là où elle existe, mais l'incohérence entre les deux modes
   reste.
4. **226 exercices `transform` sur 290 ont un énoncé identique à leur phrase de
   départ** : la consigne ne dit pas quelle transformation appliquer. Défaut de
   contenu antérieur à ce travail, signalé et non corrigé ici.
5. **Le repêchage en choix multiple** après deux échecs est un bon geste — il
   évite l'enlisement — mais reconnaître n'est pas produire. Il est justement
   exclu de la planification FSRS, ce qui est le bon arbitrage ; à ne pas
   relâcher.

---

## 6. La règle à ne pas perdre de vue

Tout le reste de cet audit découle d'une seule ligne :

> **Le cours n'est jamais sur le chemin le plus court avant une réponse.**

Le jour où une fiche devient plus rapide à atteindre qu'un exercice, cette
application redevient un manuel — agréable, rassurant, et sans effet mesurable
six mois plus tard.
