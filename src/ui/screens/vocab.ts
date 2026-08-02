/**
 * Discovery — le carnet de vocabulaire.
 *
 * Deux gestes, et seulement deux : ajouter un mot qu'on vient d'entendre, et
 * retrouver ceux qu'on a déjà notés. Tout le reste — quand le mot revient, sous
 * quelle forme, avec quels distracteurs — est décidé par le moteur, exactement
 * comme pour la grammaire. L'écran ne planifie rien.
 *
 * L'ajout doit tenir en quelques secondes, sinon le mot se perd avant d'être
 * noté : deux champs obligatoires, trois facultatifs, et l'expression est déjà
 * dans la file du soir.
 */

import { carnetOf, VOCAB_PACK_ID } from '../../carnets';
import { formatDelay, State } from '../../engine/scheduler';
import { contentLang } from '../../packs/schema';
import { isGraduated, packCards } from '../../storage/cards';
import type { CardRecord, VocabRecord } from '../../storage/db';
import { deleteVocab, listVocab, saveVocab, VocabError } from '../../storage/vocab';
import { el, mount } from '../dom';
import { listenButton, stopSpeaking } from '../speech';
import type { Ctx, VocabOptions } from '../types';

/** Au-delà de ce nombre de mots, la liste vaut la peine d'être filtrée. */
const SEARCH_THRESHOLD = 8;

interface Field {
  key: 'term' | 'meaning' | 'example' | 'note' | 'tag';
  label: string;
  hint?: string;
  required?: boolean;
  lang?: string;
}

const FIELDS: Field[] = [
  {
    key: 'term',
    label: 'L’expression, en anglais',
    hint: 'Telle que tu l’as entendue — « gert lush », « to fancy something ».',
    required: true,
    lang: 'en',
  },
  {
    key: 'meaning',
    label: 'Ce que ça veut dire, en français',
    hint: 'C’est ce sens-là qui te sera demandé, à toi de retrouver l’anglais.',
    required: true,
  },
  {
    key: 'example',
    label: 'Une phrase qui la contient',
    hint: 'Facultatif — mais c’est elle qui devient un texte à trou, et un mot vu en contexte tient bien mieux.',
    lang: 'en',
  },
  {
    key: 'note',
    label: 'Une remarque',
    hint: 'Facultatif. Servira d’indice quand tu sécheras.',
  },
  {
    key: 'tag',
    label: 'Étiquette',
    hint: 'Facultatif : pub, boulot, transports…',
  },
];

/** L'état d'un mot, résumé en une pastille. */
function statusOf(cards: CardRecord[], now: Date): { label: string; tone: string } {
  if (cards.length === 0) return { label: 'à découvrir', tone: 'fresh' };
  if (cards.every((c) => c.state === State.New)) return { label: 'à découvrir', tone: 'fresh' };
  if (cards.some((c) => c.state !== State.New && c.due <= now)) {
    return { label: 'à revoir', tone: 'due' };
  }
  if (cards.every((c) => isGraduated(c))) return { label: 'en maintenance', tone: 'kept' };

  const soonest = cards
    .filter((c) => c.state !== State.New)
    .reduce<Date | null>((best, c) => (!best || c.due < best ? c.due : best), null);
  return { label: soonest ? `revient ${formatDelay(now, soonest)}` : 'en cours', tone: 'kept' };
}

export async function renderVocab(ctx: Ctx, opts: VocabOptions): Promise<void> {
  stopSpeaking();

  const carnet = carnetOf(ctx.carnets, VOCAB_PACK_ID);
  const lang = carnet ? contentLang(carnet.pack) : 'en-GB';
  const now = new Date();

  const [entries, cards] = await Promise.all([listVocab(), packCards(VOCAB_PACK_ID)]);

  const cardsByItem = new Map<string, CardRecord[]>();
  for (const card of cards) {
    const list = cardsByItem.get(card.itemId) ?? [];
    list.push(card);
    cardsByItem.set(card.itemId, list);
  }

  const editing = opts.editId ? entries.find((e) => e.id === opts.editId) : undefined;
  const composing = opts.compose === true || editing !== undefined;

  // --- formulaire ---

  const inputs = new Map<Field['key'], HTMLInputElement>();
  const errorSlot = el('div', { class: 'slot' });

  function formCard(): HTMLElement {
    const rows = FIELDS.map((field) => {
      const input = el('input', {
        class: 'ex-field',
        type: 'text',
        id: `vocab-${field.key}`,
        autocomplete: 'off',
        autocapitalize: field.key === 'term' || field.key === 'example' ? 'off' : 'sentences',
        // Le correcteur du téléphone « corrige » volontiers l'argot bristolien
        // en anglais standard : sur l'expression elle-même, on le coupe.
        spellcheck: field.key === 'term' ? 'false' : 'true',
        ...(field.lang ? { lang: field.lang } : {}),
      });
      input.value = editing?.[field.key] ?? '';
      inputs.set(field.key, input);

      return el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: `vocab-${field.key}` }, [
          field.label,
          field.required && el('span', { class: 'field__required' }, [' — obligatoire']),
        ]),
        input,
        field.hint && el('small', { class: 'field__hint' }, [field.hint]),
      ]);
    });

    const save = el('button', { class: 'btn btn--primary', type: 'submit' }, [
      editing ? 'Enregistrer les modifications' : 'Ajouter au carnet',
    ]);
    const cancel = el('button', { class: 'btn btn--quiet', type: 'button' }, ['Annuler']);
    cancel.addEventListener('click', () => void ctx.nav.vocab());

    const form = el('form', { class: 'card vocab-form' }, [
      el('h2', {}, [editing ? 'Modifier ce mot' : 'Un nouveau mot']),
      ...rows,
      errorSlot,
      el('div', { class: 'actions' }, [save, cancel]),
    ]);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void submit();
    });

    return form;
  }

  async function submit(): Promise<void> {
    const read = (key: Field['key']) => inputs.get(key)?.value ?? '';
    try {
      await saveVocab({
        ...(editing ? { id: editing.id } : {}),
        term: read('term'),
        meaning: read('meaning'),
        example: read('example'),
        note: read('note'),
        tag: read('tag'),
      });
      await ctx.nav.vocab();
    } catch (error) {
      const message = error instanceof VocabError ? error.message : 'L’enregistrement a échoué.';
      mount(errorSlot, el('p', { class: 'field__error' }, [message]));
      inputs.get(message.includes('sens') ? 'meaning' : 'term')?.focus();
    }
  }

  // --- liste ---

  const listSlot = el('div', { class: 'vocab-list' });

  /** Tout ce sur quoi la recherche doit mordre, aplati une fois pour toutes. */
  const searchKey = (entry: VocabRecord) =>
    [entry.term, entry.meaning, entry.tag, entry.example].filter(Boolean).join(' ').toLowerCase();

  function entryRow(entry: VocabRecord): HTMLElement {
    const status = statusOf(cardsByItem.get(entry.id) ?? [], now);

    const edit = el('button', { class: 'btn btn--link', type: 'button' }, ['Modifier']);
    edit.addEventListener('click', () => void ctx.nav.vocab({ editId: entry.id }));

    // Suppression en deux temps plutôt qu'une boîte de dialogue : le second
    // appui est le garde-fou, et il reste dans la page.
    const remove = el('button', { class: 'btn btn--link btn--danger', type: 'button' }, [
      'Supprimer',
    ]);
    let armed = false;
    remove.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        remove.replaceChildren(document.createTextNode('Confirmer la suppression'));
        window.setTimeout(() => {
          armed = false;
          remove.replaceChildren(document.createTextNode('Supprimer'));
        }, 4000);
        return;
      }
      void deleteVocab(entry.id).then(() => ctx.nav.vocab());
    });

    return el('article', { class: 'vocab-item', 'data-search': searchKey(entry) }, [
      el('div', { class: 'vocab-item__head' }, [
        el('p', { class: 'vocab-item__term', lang: 'en' }, [entry.term]),
        el('span', { class: `chip chip--${status.tone}` }, [status.label]),
      ]),
      el('p', { class: 'vocab-item__meaning' }, [entry.meaning]),
      entry.example && el('p', { class: 'vocab-item__example', lang: 'en' }, [entry.example]),
      entry.note && el('p', { class: 'vocab-item__note' }, [entry.note]),
      el('div', { class: 'vocab-item__actions' }, [
        listenButton(entry.term, lang),
        entry.tag && el('span', { class: 'chip chip--tag' }, [entry.tag]),
        edit,
        remove,
      ]),
    ]);
  }

  listSlot.append(...entries.map(entryRow));

  const search = el('input', {
    class: 'ex-field vocab-search',
    type: 'search',
    placeholder: 'Chercher un mot, un sens, une étiquette…',
    'aria-label': 'Chercher dans mon vocabulaire',
    autocomplete: 'off',
  });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const node of listSlot.children) {
      const hay = node.getAttribute('data-search') ?? '';
      (node as HTMLElement).hidden = q.length > 0 && !hay.includes(q);
    }
  });

  // --- assemblage ---

  const back = el('button', { class: 'btn btn--link', type: 'button' }, ['← Retour aux carnets']);
  back.addEventListener('click', () => void ctx.nav.home());

  const add = el('button', { class: 'btn btn--primary', type: 'button' }, [
    'J’ai un mot à ajouter',
  ]);
  add.addEventListener('click', () => void ctx.nav.vocab({ compose: true }));

  mount(
    ctx.root,
    el('div', { class: 'crumb' }, [back]),
    el('header', { class: 'masthead' }, [
      el('p', { class: 'topic-label' }, ['Discovery']),
      el('h1', {}, ['Mon vocabulaire']),
      el('p', { class: 'sub' }, [
        entries.length === 0
          ? 'Rien encore. Le premier mot que tu notes entre aussitôt dans la révision.'
          : entries.length === 1
            ? 'Un mot dans le carnet.'
            : `${entries.length} mots dans le carnet.`,
      ]),
    ]),
    composing ? formCard() : el('div', { class: 'actions' }, [add]),
    entries.length >= SEARCH_THRESHOLD && search,
    entries.length > 0 && listSlot,
  );

  if (composing) inputs.get('term')?.focus();
}
