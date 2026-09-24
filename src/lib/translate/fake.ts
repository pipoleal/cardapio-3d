import type { Translator } from "./provider";

const PREFIX = { en: "[EN] ", es: "[ES] " } as const;

/**
 * Provedor de dev: sem chamada de rede, sem custo, sem credencial —
 * prefixa cada valor pra dar pra ver o fluxo de tradução funcionando
 * (botão, i18nStatus "auto", aprovar) sem gastar cota da Cloud Translation.
 */
export class FakeTranslator implements Translator {
  async translateFields(
    fields: Record<string, string>,
    target: "en" | "es",
  ): Promise<Record<string, string>> {
    const prefix = PREFIX[target];
    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, `${prefix}${value}`]),
    );
  }
}
