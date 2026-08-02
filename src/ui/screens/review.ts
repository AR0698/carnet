import { rendererFor } from '../../engine/exercises';
import { formatDelay } from '../../engine/scheduler';
import { recordAnswer, type Session } from '../../engine/session';
import { el, mount } from '../dom';
import type { AnsweredCard, Ctx } from '../types';

export function renderReview(ctx: Ctx, session: Session): void {
  const answered: AnsweredCard[] = [];
  let index = 0;

  function finish(): void {
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

    const renderer = rendererFor(current.exercise.type);
    const startedAt = performance.now();
    let usedHint = false;
    let locked = false;

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

    // --- corps de l'exercice ---
    const body = el('div', { class: 'ex-body' });
    const handle = renderer.render(current.exercise, body);

    const hintSlot = el('div');
    const verdictSlot = el('div');

    const primary = el('button', { class: 'btn btn--primary', type: 'button' }, ['Vérifier']);
    const actions = el('div', { class: 'actions' }, [primary]);

    const hints = current.exercise.hints ?? [];
    if (hints.length > 0) {
      const hintBtn = el('button', { class: 'btn btn--link', type: 'button' }, ['Un indice']);
      hintBtn.addEventListener('click', () => {
        usedHint = true;
        mount(hintSlot, el('p', { class: 'hint' }, [hints[0]]));
        hintBtn.remove();
        handle.focus();
      });
      actions.append(hintBtn);
    }

    const submit = async (): Promise<void> => {
      if (locked) {
        index += 1;
        step();
        return;
      }

      const value = handle.getValue();
      if (value.trim().length === 0) {
        handle.focus();
        return;
      }

      locked = true;
      primary.disabled = true;
      handle.lock();
      actions.querySelector('.btn--link')?.remove();

      const result = renderer.grade(current.exercise, value);
      const outcome = await recordAnswer(current.card, {
        correct: result.correct,
        usedHint,
        elapsedMs: performance.now() - startedAt,
        interleaved: session.interleaved,
        rescue: current.rescue,
      });

      answered.push({
        topicTitle: current.topicTitle,
        prompt: current.exercise.prompt,
        correct: result.correct,
        nextDue: outcome.card.due,
      });

      mount(
        verdictSlot,
        el('div', { class: `verdict ${result.correct ? 'verdict--ok' : 'verdict--ko'}` }, [
          el('strong', {}, [result.feedback]),
          result.alternatives.length > 0 &&
            el('span', { class: 'alt' }, [`Aussi accepté : ${result.alternatives.join(' · ')}`]),
          el('span', { class: 'alt' }, [
            `On la revoit ${formatDelay(new Date(), outcome.card.due)}.`,
          ]),
        ]),
      );

      primary.textContent = index === session.cards.length - 1 ? 'Terminer' : 'Suivant';
      primary.disabled = false;
      primary.focus();
    };

    primary.addEventListener('click', () => void submit());
    handle.onSubmit(() => void submit());

    mount(
      ctx.root,
      bar,
      el('section', { class: 'card' }, [
        el('p', { class: 'topic-label' }, [current.topicTitle]),
        current.rescue &&
          el('p', { class: 'rescue-note' }, [
            'Celle-ci résiste. On la reprend autrement, puis on y reviendra.',
          ]),
        body,
        hintSlot,
        verdictSlot,
        actions,
      ]),
    );

    handle.focus();
  }

  step();
}
