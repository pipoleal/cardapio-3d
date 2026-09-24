/**
 * "Saiu do forno": true por `freshHours` a partir de `freshFromOvenAt`.
 * Pura — recebe `now` de fora pra ser testável e pra nunca rodar dentro de
 * uma função `'use cache'` (o selo tem que refletir a hora real da
 * requisição, não a hora em que o cache foi preenchido). Ver lib/menu.ts.
 */
export function isFresh(
  freshFromOvenAt: Date | null | undefined,
  freshHours: number,
  now: number = Date.now(),
): boolean {
  if (!freshFromOvenAt) return false;
  const elapsedHours = (now - freshFromOvenAt.getTime()) / (1000 * 60 * 60);
  return elapsedHours < freshHours;
}
