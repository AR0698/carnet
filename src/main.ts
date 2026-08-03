import './ui/app.css';

import { carnetOf, loadCarnets, refreshVocabCarnet } from './carnets';
import { buildSession } from './engine/session';
import { PackValidationError } from './packs';
import { initInstallPrompt } from './pwa/install';
import { initServiceWorker, onServiceWorkerChange } from './pwa/register';
import { requestPersistentStorage } from './storage/persist';
import { el, mount } from './ui/dom';
import { renderBackup } from './ui/screens/backup';
import { renderCourse } from './ui/screens/course';
import { renderHome } from './ui/screens/home';
import { renderInsights } from './ui/screens/insights';
import { renderOrder } from './ui/screens/order';
import { renderReview } from './ui/screens/review';
import { renderSummary } from './ui/screens/summary';
import { renderVocab } from './ui/screens/vocab';
import { warmVoices } from './ui/speech';
import type { Ctx, Nav } from './ui/types';

type Screen = 'home' | 'review' | 'summary' | 'vocab' | 'insights' | 'order' | 'backup' | 'course';

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('#app introuvable');

  // Hors du try : une PWA qui ne s'installe pas reste une application qui
  // fonctionne, et l'inverse n'est pas vrai.
  initServiceWorker();
  initInstallPrompt();
  // La liste des voix du système arrive de façon asynchrone : on l'amorce ici
  // pour que le premier « Écouter » n'attende pas.
  warmVoices();

  try {
    const { carnets, failures } = await loadCarnets();

    const ctx = { carnets, failures, root } as Ctx;
    let screen: Screen = 'home';

    const nav: Nav = {
      async home() {
        screen = 'home';
        await renderHome(ctx);
      },
      async startSession(packId, minutes, mode) {
        const carnet = carnetOf(ctx.carnets, packId);
        if (!carnet) {
          await nav.home();
          return;
        }
        const session = await buildSession(carnet.pack, minutes, { mode });
        if (session.cards.length === 0) {
          await nav.home();
          return;
        }
        screen = 'review';
        renderReview(ctx, session);
      },
      async summary(result) {
        screen = 'summary';
        renderSummary(ctx, result);
        // Une session menée à son terme : le moment où le navigateur est le
        // plus enclin à accorder un stockage durable (§5).
        if (result.answered.length > 0) void requestPersistentStorage();
      },
      async vocab(opts) {
        screen = 'vocab';
        // Le pack personnel est reconstruit à chaque passage : un mot ajouté
        // doit pouvoir tomber dès la session suivante, sans redémarrage.
        await refreshVocabCarnet(ctx.carnets);
        await renderVocab(ctx, opts ?? {});
      },
      async insights() {
        screen = 'insights';
        await renderInsights(ctx);
      },
      async order(packId) {
        screen = 'order';
        await renderOrder(ctx, packId);
      },
      async backup() {
        screen = 'backup';
        await renderBackup(ctx);
      },
      async course(opts) {
        screen = 'course';
        await renderCourse(ctx, opts);
      },
    };
    ctx.nav = nav;

    // Une mise à jour peut arriver pendant que l'accueil est affiché : l'encart
    // doit apparaître sans attendre. Ailleurs, on ne dérange pas.
    onServiceWorkerChange(() => {
      if (screen === 'home') void nav.home();
    });

    await nav.home();
  } catch (error) {
    renderError(root, error);
  }
}

function renderError(root: HTMLElement, error: unknown): void {
  const detail =
    error instanceof PackValidationError
      ? error.issues.map((i) => `• ${i}`).join('\n')
      : error instanceof Error
        ? error.message
        : String(error);

  mount(
    root,
    el('header', { class: 'masthead' }, [
      el('h1', {}, ['Aucun carnet n’a pu être ouvert']),
      el('p', { class: 'sub' }, ['La progression enregistrée n’est pas affectée.']),
    ]),
    el('section', { class: 'card' }, [el('p', { class: 'error' }, [detail])]),
  );
  console.error('[carnet]', error);
}

void boot();
