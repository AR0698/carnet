/**
 * Lecture à voix haute — `speechSynthesis`, la voix déjà installée sur l'appareil.
 *
 * Choix assumé : aucune dépendance, aucun fichier audio, aucun appel réseau.
 * On ne peut donc pas choisir la qualité de la voix, et un appareil dépourvu
 * de voix pour la langue du pack lira mal, voire pas du tout. En échange, ça
 * marche hors ligne, ça ne pèse rien dans le bundle, et rien ne sort du
 * téléphone.
 *
 * La prononciation est un extra : le bouton disparaît là où l'API n'existe
 * pas, et rien d'autre ne bouge.
 */

import { el } from './dom';

/** Un peu en dessous du débit normal : on écoute pour reproduire, pas pour aller vite. */
const RATE = 0.9;

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * La liste des voix arrive de façon asynchrone sur certains navigateurs : ce
 * premier appel, fait au démarrage, l'amorce pour que la première lecture ne
 * tombe pas sur une liste vide.
 */
export function warmVoices(): void {
  if (speechSupported()) window.speechSynthesis.getVoices();
}

function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  const wanted = lang.toLowerCase().replace('_', '-');
  const base = wanted.split('-')[0]!;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === wanted) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base))
  );
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
  // Sans voix explicite, le navigateur choisit à partir de `lang` seul —
  // souvent bien, parfois avec l'accent de la langue système.
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
