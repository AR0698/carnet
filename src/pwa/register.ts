/**
 * Enregistrement du service worker.
 *
 * Le nouveau worker n'est jamais activé de force : une révision en cours ne
 * doit pas être interrompue par un rechargement. La mise à jour attend, et
 * l'application la propose depuis l'écran d'accueil.
 */

import { registerSW } from 'virtual:pwa-register';

type Listener = () => void;

let updateReady = false;
let offlineReady = false;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function initServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      notify();
    },
    onOfflineReady() {
      offlineReady = true;
      notify();
    },
    onRegisterError(error) {
      console.error('[carnet] service worker', error);
    },
  });
}

/** Une nouvelle version est téléchargée et attend d'être appliquée. */
export function hasPendingUpdate(): boolean {
  return updateReady;
}

/** L'application a fini d'être mise en cache : elle marchera hors connexion. */
export function isOfflineReady(): boolean {
  return offlineReady;
}

/**
 * À n'appeler qu'en dehors d'une session : réveille le worker en attente puis
 * recharge la page.
 *
 * On s'adresse directement au worker en attente plutôt que d'utiliser le
 * `updateSW()` de vite-plugin-pwa : celui-ci ne réagit pas quand la mise à
 * jour a été détectée par un `registration.update()` extérieur à
 * workbox-window (relance de l'application, autre onglet), et le bouton reste
 * alors sans effet. Le service worker généré répond déjà à `SKIP_WAITING`.
 */
export async function applyPendingUpdate(): Promise<void> {
  if (!updateReady) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (!waiting) {
    location.reload();
    return;
  }

  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
  // Filet : si le worker ne prend pas la main, on recharge quand même.
  setTimeout(reload, 3000);

  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Force le passage d'une ressource par le service worker pour qu'elle entre
 * dans le cache d'exécution. Sert au pack de contenu : il est chargé au
 * démarrage, parfois avant que le worker ne contrôle la page — sans ce
 * rattrapage, la toute première visite laisserait l'application sans contenu
 * une fois hors connexion.
 */
export async function warmRuntimeCache(url: string, timeoutMs = 8000): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.ready;
    if (!(await waitForController(timeoutMs))) return; // ce sera fait au prochain lancement
    await fetch(url);
  } catch {
    // Hors connexion, ou worker indisponible : rien à rattraper.
  }
}

/**
 * `serviceWorker.ready` se résout dès l'activation, mais la prise de contrôle
 * de la page (`clientsClaim`) arrive un instant plus tard. Tant que la page
 * n'est pas contrôlée, ses requêtes ne passent pas par le worker et ne sont
 * donc pas mises en cache.
 */
function waitForController(timeoutMs: number): Promise<boolean> {
  if (navigator.serviceWorker.controller) return Promise.resolve(true);

  return new Promise((resolve) => {
    const done = (result: boolean) => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve(result);
    };
    const onChange = () => done(true);
    const timer = setTimeout(() => done(false), timeoutMs);
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
  });
}

export function onServiceWorkerChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
