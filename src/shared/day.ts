/**
 * Jour calendaire local, au format YYYY-MM-DD.
 *
 * Volontairement local et non UTC : « hier » et « aujourd'hui » se comptent
 * là où se trouve l'apprenante, pas à Greenwich. C'est cette clé qui décide
 * si deux réussites sont espacées ou non.
 */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
