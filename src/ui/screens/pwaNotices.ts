/**
 * Encarts liés à l'installation et aux mises à jour.
 *
 * Ils n'apparaissent que sur l'écran d'accueil : jamais pendant une révision,
 * où ils voleraient l'attention et l'unique bouton primaire de l'écran.
 */

import {
  canPromptInstall,
  isStandalone,
  needsIOSInstructions,
  promptInstall,
} from '../../pwa/install';
import { applyPendingUpdate, hasPendingUpdate } from '../../pwa/register';
import { kvGet, kvSet } from '../../storage/db';
import { el } from '../dom';

const DISMISS_KEY = 'installNoticeDismissed';

function updateNotice(): HTMLElement {
  const button = el('button', { class: 'btn btn--quiet', type: 'button' }, ['Redémarrer']);
  button.addEventListener('click', () => void applyPendingUpdate());

  return el('section', { class: 'pwa-note' }, [
    el('p', {}, ['Une nouvelle version est prête. Elle s’appliquera au redémarrage.']),
    el('div', { class: 'pwa-note__actions' }, [button]),
  ]);
}

async function installNotice(refresh: () => void): Promise<HTMLElement | null> {
  if (isStandalone()) return null;
  if (await kvGet<boolean>(DISMISS_KEY)) return null;

  const dismiss = el('button', { class: 'btn btn--link', type: 'button' }, ['Plus tard']);
  dismiss.addEventListener('click', async () => {
    await kvSet(DISMISS_KEY, true);
    refresh();
  });

  // Android, Chrome desktop : le navigateur sait installer, il suffit de demander.
  if (canPromptInstall()) {
    const install = el('button', { class: 'btn btn--quiet', type: 'button' }, [
      'Installer Carnet',
    ]);
    install.addEventListener('click', async () => {
      await promptInstall();
      refresh();
    });

    return el('section', { class: 'pwa-note' }, [
      el('p', {}, [
        'Installe Carnet sur ton écran d’accueil : il s’ouvrira en plein écran et fonctionnera sans connexion.',
      ]),
      el('div', { class: 'pwa-note__actions' }, [install, dismiss]),
    ]);
  }

  // iOS : aucune API d'installation, seule la marche à suivre peut aider.
  if (needsIOSInstructions()) {
    return el('section', { class: 'pwa-note' }, [
      el('p', {}, ['Pour garder Carnet à portée de main, ajoute-le à ton écran d’accueil :']),
      el('ol', { class: 'pwa-note__steps' }, [
        el('li', {}, ['dans Safari, touche le bouton Partager, en bas de l’écran ;']),
        el('li', {}, ['choisis « Sur l’écran d’accueil ».']),
      ]),
      el('p', {}, ['L’application s’ouvrira en plein écran et fonctionnera sans connexion.']),
      el('div', { class: 'pwa-note__actions' }, [dismiss]),
    ]);
  }

  return null;
}

export async function renderPwaNotices(refresh: () => void): Promise<HTMLElement[]> {
  const notices: HTMLElement[] = [];
  if (hasPendingUpdate()) notices.push(updateNotice());

  const install = await installNotice(refresh);
  if (install) notices.push(install);

  return notices;
}
