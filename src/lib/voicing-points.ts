/**
 * Voicing points calculation:
 * - SATB / 4-Part Full Choir: +5 pts
 * - Sectional Voicings (Soprano, Alto, Tenor, Bass): +2 pts
 * - Melody / Solo Guide: +1 pt
 * - Custom / Others: +1 pt
 */
export function getVoicingPoints(label: string | null, voicePart?: string | null): number {
  const norm = (label || voicePart || '').toUpperCase().trim();
  if (
    norm.includes('SATB') ||
    norm.includes('ALL PARTS') ||
    norm.includes('4-PART') ||
    norm.includes('FOUR-PART') ||
    norm.includes('FULL CHOIR')
  ) {
    return 5;
  }
  if (
    norm.includes('SOPRANO') ||
    norm.includes('ALTO') ||
    norm.includes('TENOR') ||
    norm.includes('BASS')
  ) {
    return 2;
  }
  if (norm.includes('MELODY')) {
    return 1;
  }
  return 1;
}
