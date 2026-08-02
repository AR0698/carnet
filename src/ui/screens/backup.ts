/**
 * Sauvegarde — exporter, restaurer.
 *
 * L'écran a une seule responsabilité morale : ne jamais remplacer la base sans
 * que l'utilisatrice ait vu, en chiffres, ce qui part et ce qui arrive. D'où le
 * détour par un récapitulatif du fichier avant toute écriture.
 */

import {
  backupFilename,
  buildBackup,
  BackupError,
  parseBackup,
  restoreBackup,
  summarise,
  type Backup,
} from '../../storage/backup';
import { el, mount } from '../dom';
import type { Ctx } from '../types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function describe(summary: { words: number; cards: number; reviews: number }): string {
  return [
    plural(summary.words, 'mot personnel', 'mots personnels'),
    plural(summary.cards, 'carte', 'cartes'),
    plural(summary.reviews, 'réponse enregistrée', 'réponses enregistrées'),
  ].join(' · ');
}

/**
 * Déclenche le téléchargement.
 *
 * L'URL d'objet est révoquée au tour de boucle suivant, jamais dans la foulée
 * du clic : plusieurs navigateurs n'ont pas encore lu le blob à cet instant et
 * le fichier arriverait vide.
 */
function download(content: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = el('a', { href: url, download: filename });
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** iOS ne descend pas toujours un blob dans Fichiers : la feuille de partage, si. */
function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

export async function renderBackup(ctx: Ctx): Promise<void> {
  const backup = await buildBackup();
  const content = JSON.stringify(backup, null, 2);
  const filename = backupFilename();
  const file = new File([content], filename, { type: 'application/json' });

  const back = el('button', { class: 'btn btn--link', type: 'button' }, ['← Retour aux carnets']);
  back.addEventListener('click', () => void ctx.nav.home());

  // --- export ---

  const save = el('button', { class: 'btn btn--primary', type: 'button' }, [
    'Télécharger la sauvegarde',
  ]);
  save.addEventListener('click', () => download(content, filename));

  const share = el('button', { class: 'btn btn--quiet', type: 'button' }, ['Partager le fichier']);
  share.addEventListener('click', () => {
    void navigator.share({ files: [file], title: filename }).catch(() => {
      // Partage refusé ou annulé : le téléchargement reste disponible juste à côté.
    });
  });

  // --- import ---

  const picker = el('input', {
    class: 'visually-hidden',
    type: 'file',
    accept: 'application/json,.json',
    id: 'backup-file',
  });
  const importSlot = el('div', { class: 'slot' });

  const choose = el('button', { class: 'btn btn--quiet', type: 'button' }, [
    'Choisir un fichier de sauvegarde',
  ]);
  choose.addEventListener('click', () => picker.click());

  picker.addEventListener('change', () => {
    const chosen = picker.files?.[0];
    if (!chosen) return;
    void chosen
      .text()
      .then((raw) => confirmRestore(parseBackup(raw), chosen.name))
      .catch((error: unknown) => {
        const message =
          error instanceof BackupError ? error.message : 'Ce fichier n’a pas pu être lu.';
        mount(importSlot, el('p', { class: 'field__error' }, [message]));
      });
  });

  /** Deuxième temps : on montre ce que le fichier contient, puis on demande. */
  function confirmRestore(incoming: Backup, name: string): void {
    const summary = summarise(incoming);
    const confirm = el('button', { class: 'btn btn--primary btn--danger-solid', type: 'button' }, [
      'Remplacer mes données par ce fichier',
    ]);
    const cancel = el('button', { class: 'btn btn--quiet', type: 'button' }, ['Annuler']);
    cancel.addEventListener('click', () => {
      picker.value = '';
      mount(importSlot);
    });

    confirm.addEventListener('click', () => {
      confirm.disabled = true;
      void restoreBackup(incoming)
        .then(() => {
          // Les carnets en mémoire décrivent l'ancienne base : on repart du
          // démarrage plutôt que de rafistoler un état déjà faux.
          window.location.reload();
        })
        .catch((error: unknown) => {
          confirm.disabled = false;
          mount(
            importSlot,
            el('p', { class: 'field__error' }, [
              error instanceof Error ? error.message : 'La restauration a échoué.',
            ]),
          );
        });
    });

    mount(
      importSlot,
      el('div', { class: 'reveal' }, [
        el('span', { class: 'reveal__label' }, [name]),
        el('p', {}, [
          incoming.exportedAt
            ? `Sauvegarde du ${new Date(incoming.exportedAt).toLocaleString('fr-FR')}.`
            : 'Sauvegarde sans date.',
        ]),
        el('p', {}, [describe(summary)]),
        el('p', { class: 'field__error' }, [
          `Tout ce qui est sur cet appareil sera remplacé : ${describe(summarise(backup))}.`,
        ]),
        el('div', { class: 'actions' }, [confirm, cancel]),
      ]),
    );
  }

  mount(
    ctx.root,
    el('div', { class: 'crumb' }, [back]),
    el('header', { class: 'masthead' }, [
      el('h1', {}, ['Sauvegarde']),
      el('p', { class: 'sub' }, [
        'Les packs se retéléchargent ; tes mots, non. Un fichier de temps en temps, et rien ne se perd.',
      ]),
    ]),
    el('section', { class: 'card' }, [
      el('h2', {}, ['Exporter']),
      el('p', { class: 'notice' }, [describe(summarise(backup))]),
      el('p', { class: 'notice' }, [
        'Un seul fichier, lisible, qui contient le carnet Discovery, l’état de toutes les cartes et l’historique des réponses.',
      ]),
      el('div', { class: 'actions' }, [save, canShareFile(file) && share]),
    ]),
    el('section', { class: 'card' }, [
      el('h2', {}, ['Restaurer']),
      el('p', { class: 'notice' }, [
        'La restauration remplace l’intégralité des données de cet appareil par celles du fichier. ' +
          'Elle ne fusionne pas : exporte d’abord si tu as travaillé depuis ta dernière sauvegarde.',
      ]),
      el('div', { class: 'actions' }, [choose, picker]),
      importSlot,
    ]),
    el('details', { class: 'how' }, [
      el('summary', {}, ['Pourquoi c’est nécessaire']),
      el('ul', {}, [
        el('li', {}, [
          'Tout vit dans le navigateur de cet appareil, sans compte et sans serveur : personne d’autre n’a de copie.',
        ]),
        el('li', {}, [
          'iOS peut effacer les données d’un site resté longtemps sans visite. L’application demande un stockage durable après chaque session, mais c’est une demande, pas une garantie.',
        ]),
        el('li', {}, [
          'Changer de téléphone, réinstaller, effacer l’historique : autant d’occasions où seul un fichier exporté ramène le carnet.',
        ]),
      ]),
    ]),
  );
}
