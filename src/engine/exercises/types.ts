import type { Exercise } from '../../packs/schema';

import type { Correction } from '../grading';

export interface GradeResult {
  correct: boolean;
  /** Phrase de retour, déjà rédigée sur le ton de l'application. */
  feedback: string;
  /** Réponse canonique, à afficher en correction. */
  expected: string;
  /** Autres formulations acceptées, s'il y en a. */
  alternatives: string[];
  /** Analyse de l'erreur : mots en cause et explication. Absente si la réponse est juste. */
  correction?: Correction;
}

/**
 * Poignée rendue par `render()`. Elle donne au moteur de session le contrôle
 * du champ de saisie sans qu'il ait à connaître sa structure DOM.
 */
export interface ExerciseHandle {
  getValue(): string;
  focus(): void;
  /** Fige la saisie une fois la réponse validée. */
  lock(): void;
  /** Valider au clavier (Entrée) sans passer par le bouton. */
  onSubmit(cb: () => void): void;
}

/**
 * Contrat commun à tous les types d'exercice. Ajouter un type ne touche que
 * ce dossier et le registre — jamais le moteur, jamais l'interface.
 */
export interface ExerciseRenderer {
  render(exercise: Exercise, container: HTMLElement): ExerciseHandle;
  grade(exercise: Exercise, userInput: string): GradeResult;
  /**
   * Le même énoncé, sans champ de saisie : mode cahier, où la réponse s'écrit
   * à la main. Facultatif — à défaut, la consigne nue est affichée, ce qui
   * suffit à un type sans matière annexe.
   */
  statement?(exercise: Exercise, container: HTMLElement): void;
}
