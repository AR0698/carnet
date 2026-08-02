/**
 * Par où commencer — l'ordre d'ouverture du contenu neuf.
 *
 * Distinction qui fonde tout ce fichier : **l'ordre des révisions appartient au
 * planificateur, l'ordre des découvertes appartient à l'apprenante.**
 *
 * Laisser choisir quelles cartes *revenir* reviendrait à faire de la pratique en
 * bloc — d'excellents résultats sur le moment, rien la semaine suivante. Mais
 * décider quel groupe de notions s'ouvre en premier n'a rien à voir : c'est un
 * ordre de parcours, pas une entorse à l'espacement. Avec 476 cartes en réserve
 * dans le seul carnet de grammaire, soit près de cinquante jours de nouveautés,
 * cet ordre change vraiment ce qu'on sait dans un mois.
 *
 * On stocke des noms de *groupes* et non de notions : quatorze groupes se
 * choisissent d'un coup d'œil, cent quarante-cinq notions non.
 */

import { kvGet, kvSet } from './db';

const key = (packId: string) => `priority:${packId}`;

/** Groupes à ouvrir en premier, dans l'ordre où ils ont été choisis. */
export async function loadPriority(packId: string): Promise<string[]> {
  return (await kvGet<string[]>(key(packId))) ?? [];
}

export async function savePriority(packId: string, groups: string[]): Promise<void> {
  await kvSet(key(packId), groups);
}

export async function togglePriority(packId: string, group: string): Promise<string[]> {
  const current = await loadPriority(packId);
  const next = current.includes(group)
    ? current.filter((g) => g !== group)
    : [...current, group];
  await savePriority(packId, next);
  return next;
}
