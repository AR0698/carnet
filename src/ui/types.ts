import type { ContentPack } from '../packs/schema';

export interface AnsweredCard {
  topicTitle: string;
  prompt: string;
  correct: boolean;
  nextDue: Date;
}

export interface SessionResult {
  minutes: number;
  planned: number;
  answered: AnsweredCard[];
}

export interface Nav {
  home(): Promise<void>;
  startSession(minutes: number): Promise<void>;
  summary(result: SessionResult): Promise<void>;
}

export interface Ctx {
  pack: ContentPack;
  root: HTMLElement;
  nav: Nav;
}
