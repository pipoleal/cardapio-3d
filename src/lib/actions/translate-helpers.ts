/**
 * Puro (sem Firestore) de propósito: compara os campos em PT antes/depois
 * de um save pra decidir se vale re-traduzir — testável sem emulador.
 * `undefined` e `""` contam como "igual" (campo ausente vs. campo vazio
 * não deveria disparar uma tradução).
 */
export function textFieldsChanged(
  before: Record<string, string | undefined>,
  after: Record<string, string | undefined>,
): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if ((before[key] ?? "") !== (after[key] ?? "")) return true;
  }
  return false;
}
