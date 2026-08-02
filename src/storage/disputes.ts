/**
 * Les formulations contestées.
 *
 * Quand l'apprenante répond « en fait je l'avais », deux choses doivent se
 * passer. La première est immédiate : la carte est renotée, sa planification
 * réparée. La seconde est différée et compte tout autant — sa formulation était
 * probablement juste, et le pack devrait l'accepter.
 *
 * On garde donc trace de ce qui a été refusé à tort, pour pouvoir l'ajouter à
 * `answerSpec.accepted` plus tard. Sans ce journal, la même bonne réponse serait
 * refusée indéfiniment et l'apprenante devrait contester chaque fois.
 *
 * La date est stockée en texte ISO plutôt qu'en `Date` : ces enregistrements
 * transitent par le magasin clé/valeur, que la sauvegarde sérialise sans réveil
 * de dates. Un `Date` en ressortirait en chaîne, silencieusement.
 */

import { kvGet, kvSet } from './db';

export interface Dispute {
  cardId: string;
  packId: string;
  /** L'énoncé, pour retrouver l'exercice sans le recharger. */
  prompt: string;
  /** Ce qui a été écrit et refusé. */
  given: string;
  /** Ce que le pack attendait. */
  expected: string;
  /** Date ISO. */
  at: string;
}

const KEY = 'disputes';

/**
 * Au-delà, les plus anciennes sont oubliées. C'est une liste de corrections à
 * porter au contenu, pas un historique : cinquante en attente veut déjà dire
 * qu'on n'y touche plus.
 */
const MAX = 50;

export async function listDisputes(): Promise<Dispute[]> {
  return (await kvGet<Dispute[]>(KEY)) ?? [];
}

export async function recordDispute(dispute: Omit<Dispute, 'at'>): Promise<void> {
  const current = await listDisputes();
  // Contester deux fois la même réponse sur la même carte n'ajoute rien.
  const already = current.some((d) => d.cardId === dispute.cardId && d.given === dispute.given);
  if (already) return;

  const next = [{ ...dispute, at: new Date().toISOString() }, ...current].slice(0, MAX);
  await kvSet(KEY, next);
}

/** Une contestation traitée dans le contenu n'a plus à figurer dans la liste. */
export async function clearDispute(cardId: string, given: string): Promise<void> {
  const current = await listDisputes();
  await kvSet(
    KEY,
    current.filter((d) => !(d.cardId === cardId && d.given === given)),
  );
}
