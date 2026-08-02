/**
 * Lecture à voix haute — `speechSynthesis`, la voix déjà installée sur l'appareil.
 *
 * Choix assumé : aucune dépendance, aucun fichier audio, aucun appel réseau.
 * On ne peut donc pas choisir la qualité de la voix, et un appareil dépourvu
 * de voix pour la langue du pack lira mal, voire pas du tout. En échange, ça
 * marche hors ligne, ça ne pèse rien dans le bundle, et rien ne sort du
 * téléphone.
 *
 * Tout le travail délicat tient dans le choix de la voix. Régler `lang` sur
 * l'énoncé ne suffit pas : iOS ignore ce champ et lit avec la voix par défaut
 * du système — un iPhone en français lit alors l'anglais avec l'accent
 * français. Il faut donc désigner une voix explicitement, et pour cela avoir
 * la liste du système sous la main, ce qui n'est vrai ni au chargement, ni
 * forcément au premier appel.
 */

import { el } from './dom';

/** Un peu en dessous du débit normal : on écoute pour reproduire, pas pour aller vite. */
const RATE = 0.9;

/**
 * Instants (en ms après le démarrage) où l'on retente de lire la liste des
 * voix. `voiceschanged` suffit sur Chrome et Firefox ; iOS ne l'émet pas
 * toujours, d'où ces quelques relances — trois lectures d'un tableau déjà en
 * mémoire, le coût est nul.
 */
const VOICE_RETRIES_MS = [250, 1_000, 3_000];

let voices: SpeechSynthesisVoice[] = [];

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refreshVoices(): void {
  if (!speechSupported()) return;
  const found = window.speechSynthesis.getVoices();
  if (found.length > 0) voices = found;
}

/**
 * Le moteur vocal d'iOS reste endormi tant qu'aucun geste ne l'a réveillé, et
 * tant qu'il dort il ne publie pas ses voix. On l'ouvre donc au premier appui
 * venu, avec un énoncé muet : au moment où l'apprenante appuiera sur
 * « Écouter », la liste sera là et la bonne voix avec.
 */
function unlockOnFirstGesture(): void {
  const unlock = (): void => {
    const silent = new SpeechSynthesisUtterance(' ');
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
    refreshVoices();
  };
  document.addEventListener('pointerdown', unlock, { once: true });
}

/** À appeler une fois au démarrage. */
export function warmVoices(): void {
  if (!speechSupported()) return;
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  for (const delay of VOICE_RETRIES_MS) window.setTimeout(refreshVoices, delay);
  unlockOnFirstGesture();
}

const normalise = (tag: string) => tag.toLowerCase().replace('_', '-');

/**
 * La meilleure voix disponible pour une langue, par ordre de préférence :
 * la variante exacte (`en-GB`) avant une autre variante de la même langue
 * (`en-US`), puis une voix embarquée avant une voix distante — celle-ci ne
 * dirait rien sans réseau, ce qui ruinerait le hors-ligne.
 */
function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) refreshVoices();

  const wanted = normalise(lang);
  const base = wanted.split('-')[0]!;
  const candidates = voices.filter((v) => normalise(v.lang).startsWith(base));
  if (candidates.length === 0) return undefined;

  const score = (v: SpeechSynthesisVoice) =>
    (normalise(v.lang) === wanted ? 4 : 0) + (v.localService ? 2 : 0) + (v.default ? 1 : 0);

  return candidates.reduce((best, v) => (score(v) > score(best) ? v : best));
}

/**
 * Référence gardée sur l'énoncé en cours. Sans elle, le ramasse-miettes peut
 * l'emporter au milieu d'une phrase et la couper net — un travers connu des
 * navigateurs fondés sur Chromium.
 */
let speaking: SpeechSynthesisUtterance | null = null;

/** Prononce une phrase. Une seule à la fois : la suivante coupe la précédente. */
export function speak(text: string, lang: string): void {
  if (!speechSupported() || text.trim().length === 0) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = RATE;
  // Sans voix désignée, iOS lit avec celle du système, quoi qu'en dise `lang`.
  const voice = voiceFor(lang);
  if (voice) utterance.voice = voice;

  speaking = utterance;
  utterance.addEventListener('end', () => {
    if (speaking === utterance) speaking = null;
  });
  synth.speak(utterance);
}

/** Coupe la lecture en cours : on quitte une carte, la phrase ne la suit pas. */
export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/**
 * Bouton « Écouter » attaché à une phrase. Renvoie `null` quand il n'y a rien
 * à prononcer ou pas de synthèse vocale : l'appelant l'insère tel quel, `el()`
 * ignore les enfants nuls.
 */
export function listenButton(text: string, lang: string): HTMLButtonElement | null {
  if (!speechSupported() || text.trim().length === 0) return null;
  const button = el('button', { class: 'btn btn--link listen', type: 'button' }, ['Écouter']);
  button.addEventListener('click', () => speak(text, lang));
  return button;
}
