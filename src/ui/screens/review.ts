import type { AnswerDiff, DiffToken } from '../../engine/diff';
import { rendererFor, renderStatement } from '../../engine/exercises';
import { canonicalAnswer, otherAnswers } from '../../engine/grading';
import { formatDelay } from '../../engine/scheduler';
import { recordAnswer, type Session } from '../../engine/session';
import { contentLang, spokenSentence } from '../../packs/schema';
import { el, mount } from '../dom';
import { listenButton, stopSpeaking } from '../speech';
import type { AnsweredCard, Ctx } from '../types';

/** Ce que l'apprenante déclare après avoir comparé sa copie à la réponse. */
interface SelfJudgement {
  correct: boolean;
  effort?: 'immediate' | 'searched';
}

/**
 * Deux lignes en vis-à-vis : ce qui a été écrit, ce qui était attendu, avec
 * les mots en cause désignés de part et d'autre. C'est souvent tout ce qu'il
 * faut pour voir soi-même où ça a dérapé.
 */
function renderDiff(diff: AnswerDiff): HTMLElement {
  const line = (label: string, tokens: DiffToken[], variant: string) =>
    el('p', { class: `diff__line diff__line--${variant}` }, [
      el('span', { class: 'diff__label' }, [label]),
      el(
        'span',
        { lang: 'en' },
        tokens.flatMap((t, i) => [
          i > 0 ? ' ' : '',
          t.kind === 'same' ? t.text : el('mark', { class: `diff--${t.kind}` }, [t.text]),
        ]),
      ),
    ]);

  return el('div', { class: 'diff' }, [
    line('Tu as écrit', diff.given, 'given'),
    line('On attendait', diff.expected, 'expected'),
  ]);
}

/** Ligne « Aussi accepté : … », tue quand il n'y a rien d'autre à montrer. */
function alternativesLine(alternatives: string[]): HTMLElement | false {
  return (
    alternatives.length > 0 &&
    el('span', { class: 'alt' }, [`Aussi accepté : ${alternatives.join(' · ')}`])
  );
}

export function renderReview(ctx: Ctx, session: Session): void {
  const answered: AnsweredCard[] = [];
  const lang = contentLang(ctx.pack);
  let index = 0;

  function finish(): void {
    stopSpeaking();
    void ctx.nav.summary({
      minutes: session.requestedMinutes,
      planned: session.cards.length,
      answered,
    });
  }

  function step(): void {
    const current = session.cards[index];
    if (!current) {
      finish();
      return;
    }
    const card = current;

    // Une phrase lue ne poursuit pas l'apprenante sur la carte suivante.
    stopSpeaking();

    const startedAt = performance.now();
    let usedHint = false;

    // --- barre de session ---
    const bar = el('div', { class: 'session-bar' }, [
      el('span', {}, [`${index + 1} / ${session.cards.length}`]),
      el('div', { class: 'progress' }, [
        el('i', { style: `width: ${(index / session.cards.length) * 100}%` }),
      ]),
    ]);
    const quit = el('button', { class: 'btn btn--link', type: 'button' }, ['Mettre en pause']);
    quit.addEventListener('click', finish);
    bar.append(quit);

    // --- ossature commune aux deux modes ---
    // Trois emplacements réservés, remplis au fil de la carte. Vides, ils ne
    // prennent pas de place : voir `.slot:empty`.
    const body = el('div', { class: 'ex-body' });
    const hintSlot = el('div', { class: 'slot' });
    const revealSlot = el('div', { class: 'slot' });
    const verdictSlot = el('div', { class: 'slot' });
    const actions = el('div', { class: 'actions' });

    /** Le bouton « Un indice », s'il y a quelque chose à révéler. */
    function addHintButton(refocus: () => void): void {
      const hints = card.exercise.hints ?? [];
      if (hints.length === 0) return;
      const button = el('button', { class: 'btn btn--link', type: 'button' }, ['Un indice']);
      button.addEventListener('click', () => {
        usedHint = true;
        mount(hintSlot, el('p', { class: 'hint' }, [hints[0]!]));
        button.remove();
        refocus();
      });
      actions.append(button);
    }

    /**
     * Enregistre la réponse, affiche la prochaine échéance, ouvre la carte
     * suivante. Sur ce point les deux modes ne diffèrent pas : même carte,
     * même FSRS, même porte de graduation.
     */
    async function commit(judgement: SelfJudgement, verdict: HTMLElement): Promise<void> {
      const outcome = await recordAnswer(card.card, {
        correct: judgement.correct,
        effort: judgement.effort,
        usedHint,
        elapsedMs: performance.now() - startedAt,
        interleaved: session.interleaved,
        rescue: card.rescue,
      });

      answered.push({
        topicTitle: card.topicTitle,
        prompt: card.exercise.prompt,
        correct: judgement.correct,
        nextDue: outcome.card.due,
      });

      verdict.append(
        el('span', { class: 'alt' }, [`On la revoit ${formatDelay(new Date(), outcome.card.due)}.`]),
      );
      mount(verdictSlot, verdict);

      const next = el('button', { class: 'btn btn--primary', type: 'button' }, [
        index === session.cards.length - 1 ? 'Terminer' : 'Suivant',
      ]);
      next.addEventListener('click', () => {
        index += 1;
        step();
      });
      mount(actions, next);
      next.focus();
    }

    // --- mode écran : on tape, l'application corrige ---
    function screenCard(): void {
      const renderer = rendererFor(card.exercise.type);
      const handle = renderer.render(card.exercise, body);
      let locked = false;

      const primary = el('button', { class: 'btn btn--primary', type: 'button' }, ['Vérifier']);
      actions.append(primary);
      addHintButton(() => handle.focus());

      const submit = async (): Promise<void> => {
        if (locked) return;
        const value = handle.getValue();
        if (value.trim().length === 0) {
          handle.focus();
          return;
        }

        locked = true;
        primary.disabled = true;
        handle.lock();

        const result = renderer.grade(card.exercise, value);
        await commit(
          { correct: result.correct },
          el('div', { class: `verdict ${result.correct ? 'verdict--ok' : 'verdict--ko'}` }, [
            el('strong', {}, [result.feedback]),
            result.correction?.diff && renderDiff(result.correction.diff),
            result.correction?.explanation &&
              el('p', { class: 'why' }, [result.correction.explanation.text]),
            alternativesLine(result.alternatives),
            listenButton(spokenSentence(card.exercise), lang),
          ]),
        );
      };

      primary.addEventListener('click', () => void submit());
      handle.onSubmit(() => void submit());
      handle.focus();
    }

    // --- mode cahier : on écrit à la main, puis on se corrige ---

    /** Le jugement, en trois issues. Chacune produit une carte de retour. */
    function judgeButton(label: string, variant: string, judgement: SelfJudgement): HTMLElement {
      const button = el('button', { class: `btn judge__btn judge__btn--${variant}`, type: 'button' }, [
        label,
      ]);
      button.addEventListener('click', () => {
        void commit(
          judgement,
          el('div', { class: `verdict ${judgement.correct ? 'verdict--ok' : 'verdict--ko'}` }, [
            el('strong', {}, [
              judgement.correct ? 'Compté juste.' : 'Comptée manquée — elle revient vite.',
            ]),
            // Ratée sans avoir demandé d'indice : c'est le moment de donner la
            // règle, tant que la question est encore chaude.
            !judgement.correct &&
              !usedHint &&
              card.exercise.hints?.[0] &&
              el('p', { class: 'why' }, [card.exercise.hints[0]!]),
          ]),
        );
      });
      return button;
    }

    /**
     * L'application n'a pas la feuille sous les yeux : elle ne peut pas
     * corriger. Elle montre la réponse juste, et c'est l'apprenante qui
     * tranche — juste ou non, et si c'était juste, venu seul ou arraché.
     * C'est exactement ce que le chronomètre déduisait à l'écran, dit par la
     * seule personne qui puisse le savoir ici.
     */
    function paperCard(): void {
      renderStatement(card.exercise, body);
      body.append(
        el('p', { class: 'paper-cue' }, ['Écris ta réponse sur le cahier, puis reviens ici.']),
      );

      const reveal = el('button', { class: 'btn btn--primary', type: 'button' }, [
        'Voir la réponse',
      ]);
      actions.append(reveal);
      addHintButton(() => reveal.focus());

      reveal.addEventListener('click', () => {
        const spec = card.exercise.answerSpec;
        const expected = canonicalAnswer(spec);

        mount(
          revealSlot,
          el('div', { class: 'reveal' }, [
            el('span', { class: 'reveal__label' }, ['La réponse']),
            el('p', { class: 'reveal__answer', lang: 'en' }, [expected]),
            alternativesLine(otherAnswers(spec, expected)),
            listenButton(spokenSentence(card.exercise), lang),
          ]),
        );

        mount(
          actions,
          el('div', { class: 'judge' }, [
            el('p', { class: 'judge__question' }, ['Compare avec ta copie. Tu l’avais ?']),
            el('div', { class: 'judge__row' }, [
              judgeButton('Sans hésiter', 'easy', { correct: true, effort: 'immediate' }),
              judgeButton('En cherchant', 'ok', { correct: true, effort: 'searched' }),
              judgeButton('Non', 'ko', { correct: false }),
            ]),
          ]),
        );
        actions.querySelector<HTMLButtonElement>('.judge__btn')?.focus();
      });

      reveal.focus();
    }

    const paper = session.mode === 'paper';

    mount(
      ctx.root,
      bar,
      el('section', { class: paper ? 'card card--paper' : 'card' }, [
        el('p', { class: 'topic-label' }, [card.topicTitle]),
        card.rescue &&
          el('p', { class: 'rescue-note' }, [
            paper
              ? 'Celle-ci résiste. On la reprend avec les formes sous les yeux : recopie la bonne.'
              : 'Celle-ci résiste. On la reprend autrement, puis on y reviendra.',
          ]),
        body,
        hintSlot,
        revealSlot,
        verdictSlot,
        actions,
      ]),
    );

    // Les deux modes remplissent la même ossature, déjà en place : le focus
    // qu'ils posent porte donc sur un élément réellement affiché.
    if (paper) paperCard();
    else screenCard();
  }

  step();
}
