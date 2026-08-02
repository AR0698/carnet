/**
 * Installation sur l'écran d'accueil.
 *
 * Deux chemins très différents :
 *  - Android / desktop : le navigateur émet `beforeinstallprompt`, on peut
 *    déclencher l'installation depuis un bouton ;
 *  - iOS : aucune API. Safari ignore le manifeste pour ça — il faut expliquer
 *    le geste (Partager → Sur l'écran d'accueil), sinon l'application ne sera
 *    jamais installée, donc jamais vraiment hors-ligne.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // on choisit nous-mêmes le moment
    deferredPrompt = e as BeforeInstallPromptEvent;
    for (const l of listeners) l();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    for (const l of listeners) l();
  });
}

export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** L'application tourne-t-elle déjà installée (hors navigateur) ? */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari iOS n'implémente pas display-mode et expose ce drapeau à la place.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // Depuis iPadOS 13, un iPad se présente comme un Mac : le tactile tranche.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Bouton d'installation possible (Android, Chrome desktop). */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  deferredPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  for (const l of listeners) l();
  return outcome === 'accepted';
}

/** iOS, pas encore installée : seule la marche à suivre peut aider. */
export function needsIOSInstructions(): boolean {
  return isIOS() && !isStandalone();
}
