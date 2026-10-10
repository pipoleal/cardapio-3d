/** Mesma preferência que `globals.css` já respeita via CSS — usada quando um
 * componente precisa saber em JS (ex.: pular o delay de uma animação de saída
 * antes de confirmar a ação). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
