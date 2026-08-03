import { carnetOf } from '../../carnets';
import type { AnswerDiff, DiffToken } from '../../engine/diff';
import { rendererFor, renderStatement, type ExerciseHandle } from '../../engine/exercises';
import { canonicalAnswer, otherAnswers } from '../../engine/grading';
import { formatDelay } from '../../engine/scheduler';
import { recordAnswer, reviseAnswer, type RecordedAnswer, type Session } from '../../engine/session';
import { contentLang, isChoice, spokenSentence, topicOf } from '../../packs/schema';
import { recordDispute } from '../../storage/disputes';
import { el, mount } from '../dom';
import { openLessonDialog } from '../lesson';
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
  const lang = contentLang(session.pack);
  const carnetLabel = carnetOf(ctx.carnets, session.pack.meta.id)?.label ?? session.pack.meta.title;
  let index = 0;

  function finish(): void {
    stopSpeaking();
    void ctx.nav.summary({
      carnetLabel,
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
    // Posée au niveau de la carte pour que `commit()` puisse lire la latence de
    // rappel. Reste indéfinie en mode cahier : là, il n'y a rien à saisir et
    // c'est le jugement déclaré qui note.
    let handle: ExerciseHandle | undefined;

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
     * Le passage d'où l'exercice est tiré — carnet Culture.
     *
     * Il n'apparaît **qu'après** la réponse, jamais avant : le texte contient
     * la forme attendue, l'afficher d'abord transformerait un rappel en
     * recopie. Une fois la réponse donnée, en revanche, relire la phrase dans
     * son contexte est exactement ce qui ancre le mot.
     */
    function passageBlock(): HTMLElement | false {
      const passage = card.item.fields.passage;
      return (
        Boolean(passage) &&
        el('div', { class: 'passage' }, [
          el('span', { class: 'passage__label' }, ['D’où ça vient']),
          el('p', { lang: 'en' }, [passage!]),
          listenButton(passage!, lang),
        ])
      );
    }

    /**
     * « Pourquoi ? » — la fiche de l'unité, ouverte par-dessus la session.
     *
     * Trois choses en font un bouton et non une explication dépliée d'office.
     * D'abord le moment : il n'apparaît qu'**après** la réponse, jamais avant,
     * sans quoi la règle serait sous les yeux au moment de la produire et le
     * rappel deviendrait de la recopie. Ensuite la trace : une faute qu'on
     * vient de faire et qui est corrigée dans la foulée se retient mieux que
     * la même règle lue sans s'être trompé — c'est le seul instant où cette
     * fiche vaut mieux qu'un exercice de plus. Enfin l'effet de bord : elle
     * s'ouvre en fenêtre, la file de révision reste derrière, intacte, et rien
     * de ce qui est lu ici ne déplace la moindre carte.
     */
    function understandButton(): HTMLElement | false {
      const topic = topicOf(session.pack, card.item.topicId);
      if (!topic?.lesson) return false;

      const button = el('button', { class: 'btn btn--link btn--why', type: 'button' }, [
        'Comprendre cette règle',
      ]);
      button.addEventListener('click', () => {
        stopSpeaking();
        openLessonDialog(topic, {
          lang,
          resolve: (id) => topicOf(session.pack, id),
        });
      });
      return button;
    }

    /**
     * Enregistre la réponse, affiche la prochaine échéance, ouvre la carte
     * suivante. Sur ce point les deux modes ne diffèrent pas : même carte,
     * même FSRS, même porte de graduation.
     */
    async function commit(
      judgement: SelfJudgement,
      verdict: HTMLElement,
    ): Promise<{ recorded: RecordedAnswer; entry: AnsweredCard }> {
      const firstInput = handle?.firstInputAt();
      const outcome = await recordAnswer(card.card, {
        correct: judgement.correct,
        effort: judgement.effort,
        usedHint,
        elapsedMs: performance.now() - startedAt,
        recallMs: firstInput === undefined ? undefined : firstInput - startedAt,
        interleaved: session.interleaved,
        rescue: card.rescue,
      });

      // Gardée par référence : une réponse contestée doit pouvoir corriger le
      // bilan de fin de session, qui la compterait sinon comme manquée.
      const entry: AnsweredCard = {
        topicTitle: card.topicTitle,
        prompt: card.exercise.prompt,
        correct: judgement.correct,
        nextDue: outcome.card.due,
      };
      answered.push(entry);

      verdict.append(
        el('span', { class: 'alt' }, [`On la revoit ${formatDelay(new Date(), outcome.card.due)}.`]),
      );
      mount(verdictSlot, verdict, passageBlock());

      const next = el('button', { class: 'btn btn--primary', type: 'button' }, [
        index === session.cards.length - 1 ? 'Terminer' : 'Suivant',
      ]);
      next.addEventListener('click', () => {
        index += 1;
        step();
      });
      mount(actions, next);
      next.focus();
      return { recorded: outcome, entry };
    }

    /**
     * « En fait, je l'avais. »
     *
     * La correction n'a pas de jugement : elle compare à une liste de
     * formulations écrites d'avance. Quand la réponse donnée en valait une qui
     * n'y figure pas, l'échec est celui du contenu, pas de la mémoire — et
     * laisser la carte porter cet échec fausserait sa planification pour des
     * mois. La réponse est donc rejouée en juste, et la formulation refusée
     * mise de côté pour être ajoutée au carnet.
     */
    function disputeButton(
      recorded: RecordedAnswer,
      entry: AnsweredCard,
      given: string,
      expected: string,
    ): HTMLElement {
      const button = el('button', { class: 'btn btn--link', type: 'button' }, [
        'En fait, je l’avais',
      ]);

      button.addEventListener('click', () => {
        button.disabled = true;
        void (async () => {
          const revised = await reviseAnswer(card.card, recorded.seq, {
            correct: true,
            usedHint,
            elapsedMs: recorded.review.elapsedMs,
            recallMs: recorded.review.recallMs,
            interleaved: session.interleaved,
            rescue: card.rescue,
          });

          await recordDispute({
            cardId: card.card.id,
            packId: card.card.packId,
            prompt: card.exercise.prompt,
            given,
            expected,
          });

          entry.correct = true;
          entry.nextDue = revised.card.due;

          // La comparaison mot à mot n'a plus lieu d'être : elle désignait des
          // écarts avec une formulation qui n'était pas la bonne cible.
          mount(
            verdictSlot,
            el('div', { class: 'verdict verdict--ok' }, [
              el('strong', {}, ['Compté juste.']),
              el('span', { class: 'alt' }, [
                `« ${given} » est mis de côté, à ajouter aux réponses acceptées du carnet.`,
              ]),
              el('span', { class: 'alt' }, [
                `On la revoit ${formatDelay(new Date(), revised.card.due)}.`,
              ]),
            ]),
            passageBlock(),
          );
        })();
      });

      return button;
    }

    // --- mode écran : on tape, l'application corrige ---
    function screenCard(): void {
      const renderer = rendererFor(card.exercise.type);
      const input = renderer.render(card.exercise, body);
      handle = input;
      let locked = false;

      const primary = el('button', { class: 'btn btn--primary', type: 'button' }, ['Vérifier']);
      actions.append(primary);
      addHintButton(() => input.focus());

      const submit = async (): Promise<void> => {
        if (locked) return;
        const value = input.getValue();
        if (value.trim().length === 0) {
          input.focus();
          return;
        }

        locked = true;
        primary.disabled = true;
        input.lock();

        const result = renderer.grade(card.exercise, value);

        // Ratée sans qu'aucune erreur anticipée ne corresponde : c'est le
        // moment de donner la règle, tant que la question est encore chaude.
        // Le mode cahier le faisait déjà ; l'écran, lui, ne montrait que la
        // comparaison mot à mot, et l'indice restait derrière un bouton qui
        // avait disparu avec la réponse.
        //
        // L'explication d'un `pitfall` passe devant quand il y en a une : elle
        // vise la faute commise, là où l'indice ne rappelle que la règle. Et
        // rien ne s'affiche si l'indice a déjà été demandé avant de répondre —
        // le relire ne serait qu'une ligne de plus à sauter.
        const fallbackHint =
          !result.correct && !result.correction?.explanation && !usedHint
            ? card.exercise.hints?.[0]
            : undefined;

        const verdict = el(
          'div',
          { class: `verdict ${result.correct ? 'verdict--ok' : 'verdict--ko'}` },
          [
            el('strong', {}, [result.feedback]),
            result.correction?.diff && renderDiff(result.correction.diff),
            result.correction?.explanation &&
              el('p', { class: 'why' }, [result.correction.explanation.text]),
            fallbackHint && el('p', { class: 'why' }, [fallbackHint]),
            alternativesLine(result.alternatives),
            listenButton(spokenSentence(card.exercise), lang),
          ],
        );

        const { recorded, entry } = await commit({ correct: result.correct }, verdict);

        if (!result.correct) {
          verdict.append(
            el('div', { class: 'verdict__actions' }, [
              understandButton(),
              // Pas de contestation quand les formes étaient sous les yeux :
              // rien n'a été formulé, il n'y a donc pas d'équivalent à avoir
              // trouvé autrement.
              !isChoice(card.exercise.type) &&
                disputeButton(recorded, entry, value.trim(), result.expected),
            ]),
          );
        }
      };

      primary.addEventListener('click', () => void submit());
      input.onSubmit(() => void submit());
      input.focus();
    }

    // --- mode cahier : on écrit à la main, puis on se corrige ---

    /** Le jugement, en trois issues. Chacune produit une carte de retour. */
    function judgeButton(label: string, variant: string, judgement: SelfJudgement): HTMLElement {
      const button = el('button', { class: `btn judge__btn judge__btn--${variant}`, type: 'button' }, [
        label,
      ]);
      button.addEventListener('click', () => {
        const verdict = el(
          'div',
          { class: `verdict ${judgement.correct ? 'verdict--ok' : 'verdict--ko'}` },
          [
            el('strong', {}, [
              judgement.correct ? 'Compté juste.' : 'Comptée manquée — elle revient vite.',
            ]),
            // Ratée sans avoir demandé d'indice : c'est le moment de donner la
            // règle, tant que la question est encore chaude.
            !judgement.correct &&
              !usedHint &&
              card.exercise.hints?.[0] &&
              el('p', { class: 'why' }, [card.exercise.hints[0]!]),
          ],
        );

        // L'accès à la fiche vient après l'échéance, pas avant : la dernière
        // chose lue doit rester « on la revoit demain », qui est ce que fait
        // l'application, et non une invitation à lire.
        void commit(judgement, verdict).then(() => {
          const why = judgement.correct ? false : understandButton();
          if (why) verdict.append(el('div', { class: 'verdict__actions' }, [why]));
        });
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
