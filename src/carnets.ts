/**
 * Les carnets ouverts dans l'application.
 *
 * Racine de composition : c'est le seul endroit qui sache à la fois qu'un
 * carnet peut venir d'un fichier statique (grammaire, culture) ou de la base
 * locale (le vocabulaire saisi à la main). Passé cette frontière, tout le monde
 * ne manipule plus que des `ContentPack` — le moteur, la session et les écrans
 * ignorent d'où vient la matière.
 */

import { loadPack, packUrl } from './packs';
import type { ContentPack } from './packs/schema';
import { warmRuntimeCache } from './pwa/register';
import { syncPackCards } from './storage/cards';
import { loadVocabPack, VOCAB_PACK_ID } from './storage/vocab';

export const GRAMMAR_PACK_ID = 'english-grammar';
export const VOCABULARY_PACK_ID = 'vocabulary';
export const CULTURE_PACK_ID = 'bristol-culture';
export { VOCAB_PACK_ID };

export interface Carnet {
  id: string;
  /** Le nom sur la couverture. */
  label: string;
  /** Une phrase : ce qu'on y travaille. */
  tagline: string;
  pack: ContentPack;
  /**
   * Ce carnet s'écrit à la main. Il se remplit, se relit et s'exporte ;
   * les autres se téléchargent et se remplacent.
   */
  personal: boolean;
}

interface StaticCarnet {
  id: string;
  label: string;
  tagline: string;
}

const STATIC_CARNETS: StaticCarnet[] = [
  {
    id: GRAMMAR_PACK_ID,
    label: 'Grammaire',
    tagline: 'La mécanique de la langue, une unité à la fois.',
  },
  {
    id: VOCABULARY_PACK_ID,
    label: 'Vocabulaire',
    tagline: 'Le bureau anglais, la tech, la scène, la ville, le pub.',
  },
  {
    id: CULTURE_PACK_ID,
    label: 'Culture',
    tagline: 'Bristol racontée en anglais — et les mots qu’on y attrape.',
  },
];

const VOCAB_CARNET = {
  label: 'Discovery',
  tagline: 'Les mots que tu ramasses en chemin.',
};

export interface CarnetFailure {
  id: string;
  message: string;
}

export interface CarnetsLoad {
  carnets: Carnet[];
  /** Ce qui n'a pas pu être ouvert — signalé, jamais fatal tant qu'il reste un carnet. */
  failures: CarnetFailure[];
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Ouvre tous les carnets et aligne leurs cartes.
 *
 * Un carnet manquant n'en emporte pas d'autres : un pack de culture absent ne
 * doit pas priver de la grammaire, ni surtout du vocabulaire personnel — le
 * seul contenu qui ne se retélécharge pas.
 */
export async function loadCarnets(): Promise<CarnetsLoad> {
  const carnets: Carnet[] = [];
  const failures: CarnetFailure[] = [];

  const settled = await Promise.allSettled([
    ...STATIC_CARNETS.map((c) => loadPack(c.id)),
    loadVocabPack(),
  ]);

  settled.forEach((result, i) => {
    const descriptor = STATIC_CARNETS[i];

    if (result.status === 'rejected') {
      failures.push({
        id: descriptor?.id ?? VOCAB_PACK_ID,
        message: messageOf(result.reason),
      });
      return;
    }

    carnets.push(
      descriptor
        ? { ...descriptor, pack: result.value, personal: false }
        : { id: VOCAB_PACK_ID, ...VOCAB_CARNET, pack: result.value, personal: true },
    );
  });

  if (carnets.length === 0) {
    throw new Error(failures.map((f) => `${f.id} : ${f.message}`).join('\n'));
  }

  // Les packs statiques entrent dans le cache d'exécution ; le vocabulaire est
  // déjà dans IndexedDB, il n'a rien à mettre en cache.
  for (const carnet of carnets) {
    if (!carnet.personal) void warmRuntimeCache(packUrl(carnet.id));
  }

  await Promise.all(
    carnets.map(async (carnet) => {
      const report = await syncPackCards(carnet.pack, { prune: !carnet.personal });
      console.info(
        `[carnet] ${carnet.id}@${carnet.pack.meta.version} — ` +
          `${report.created} créée(s), ${report.removed} retirée(s), ${report.kept} conservée(s).`,
      );
    }),
  );

  return { carnets, failures };
}

/**
 * Signature d'un pack : ce qui change quand son contenu change.
 *
 * La version seule ne suffit pas — on oublie de l'incrémenter, et le jour où
 * on l'oublie est précisément celui où l'on a ajouté cent unités. Le compte
 * d'items et de notions rattrape l'oubli sans rien coûter.
 */
const signature = (pack: ContentPack): string =>
  `${pack.meta.version}:${pack.topics.length}:${pack.items.length}`;

/**
 * Relit les packs téléchargés et réaligne les cartes.
 *
 * Pourquoi ça existe : `loadCarnets()` n'est appelé qu'au démarrage, et sur
 * iOS une PWA revenue au premier plan ne redémarre pas — le processus est
 * gardé en vie, la page n'est pas rejouée. Un carnet enrichi entre-temps
 * pouvait donc rester invisible des jours durant, sans que rien ne le signale.
 *
 * Rend `true` si quelque chose a bougé, pour que l'appelant ne redessine que
 * dans ce cas : redessiner l'accueil à chaque retour au premier plan ferait
 * clignoter un écran qui, neuf fois sur dix, n'a pas changé.
 *
 * Une lecture qui échoue est sans conséquence : on garde ce qu'on a. C'est le
 * cas normal hors connexion, et il ne mérite pas d'être signalé.
 */
export async function refreshStaticCarnets(carnets: Carnet[]): Promise<boolean> {
  const results = await Promise.all(
    carnets
      .filter((c) => !c.personal)
      .map(async (carnet) => {
        try {
          const pack = await loadPack(carnet.id);
          if (signature(pack) === signature(carnet.pack)) return false;
          carnet.pack = pack;
          await syncPackCards(pack, { prune: true });
          console.info(`[carnet] ${carnet.id} rafraîchi → ${signature(pack)}`);
          return true;
        } catch {
          return false;
        }
      }),
  );
  return results.some(Boolean);
}

/** Recharge le seul carnet personnel — après un ajout ou une suppression de mot. */
export async function refreshVocabCarnet(carnets: Carnet[]): Promise<void> {
  const carnet = carnets.find((c) => c.personal);
  if (!carnet) return;
  carnet.pack = await loadVocabPack();
  await syncPackCards(carnet.pack, { prune: false });
}

export function carnetOf(carnets: Carnet[], id: string): Carnet | undefined {
  return carnets.find((c) => c.id === id);
}
