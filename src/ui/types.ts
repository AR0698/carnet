import type { Carnet, CarnetFailure } from '../carnets';
import type { SessionMode } from '../engine/session';

export interface AnsweredCard {
  topicTitle: string;
  prompt: string;
  correct: boolean;
  nextDue: Date;
}

export interface SessionResult {
  /** Le carnet d'où venait la session — le bilan y renvoie. */
  carnetLabel: string;
  minutes: number;
  planned: number;
  answered: AnsweredCard[];
}

/** Écran de consultation du vocabulaire, formulaire d'ajout déplié ou non. */
export interface VocabOptions {
  compose?: boolean;
  /** Mot à modifier ; sans lui le formulaire est vierge. */
  editId?: string;
}

export interface Nav {
  home(): Promise<void>;
  startSession(packId: string, minutes: number, mode: SessionMode): Promise<void>;
  summary(result: SessionResult): Promise<void>;
  vocab(opts?: VocabOptions): Promise<void>;
  insights(): Promise<void>;
  backup(): Promise<void>;
}

export interface Ctx {
  carnets: Carnet[];
  root: HTMLElement;
  nav: Nav;
  /** Carnets qui n'ont pas pu être ouverts — affiché en clair, jamais tu. */
  failures: CarnetFailure[];
}
