/**
 * Traduz um conjunto de campos de uma vez (nome + descrição + nome de cada
 * variação, por exemplo) — sempre pt → target, nunca campo a campo, pra
 * bater com o `i18nStatus` por entidade (ver docs/MODELO-DE-DADOS.md).
 */
export interface Translator {
  translateFields(
    fields: Record<string, string>,
    target: "en" | "es",
  ): Promise<Record<string, string>>;
}
