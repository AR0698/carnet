import './ui/app.css';

import { buildSession } from './engine/session';
import { loadPack, packUrl, PackValidationError } from './packs';
import { initInstallPrompt } from './pwa/install';
import { initServiceWorker, onServiceWorkerChange, warmRuntimeCache } from './pwa/register';
import { syncPackCards } from './storage/cards';
import { requestPersistentStorage } from './storage/persist';
import { el, mount } from './ui/dom';
import { warmVoices } from './ui/speech';
import { renderHome } from './ui/screens/home';
import { renderReview } from './ui/screens/review';
import { renderSummary } from './ui/screens/summary';
import type { Ctx, Nav } from './ui/types';

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
    const pack = await loadPack();
    void warmRuntimeCache(packUrl(pack.meta.id));

    const report = await syncPackCards(pack);
    console.info(
      `[carnet] pack ${pack.meta.id}@${pack.meta.version} — ` +
        `${report.created} carte(s) créée(s), ${report.removed} retirée(s), ${report.kept} conservée(s).`,
    );

    const ctx = { pack, root } as Ctx;
    let screen: 'home' | 'review' | 'summary' = 'home';

    const nav: Nav = {
      async home() {
        screen = 'home';
        await renderHome(ctx);
      },
      async startSession(minutes, mode) {
        const session = await buildSession(pack, minutes, { mode });
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
      el('h1', {}, ['Le contenu n’a pas pu être chargé']),
      el('p', { class: 'sub' }, ['La progression enregistrée n’est pas affectée.']),
    ]),
    el('section', { class: 'card' }, [el('p', { class: 'error' }, [detail])]),
  );
  console.error('[carnet]', error);
}

void boot();
