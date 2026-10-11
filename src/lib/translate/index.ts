import "server-only";
import { DeepLTranslator } from "./deepl";
import { FakeTranslator } from "./fake";
import { GoogleTranslator } from "./google";
import type { Translator } from "./provider";

export type { Translator } from "./provider";

/**
 * `TRANSLATOR_PROVIDER=google` (Cloud Translation, exige faturamento no GCP)
 * ou `=deepl` (DeepL API Free, sem cartão/CNPJ pra criar conta — ver
 * docs/DECISOES.md) usam tradução de verdade; qualquer outro valor (ou
 * ausente) cai no fake — esse é o padrão em dev.
 */
export function getTranslator(): Translator {
  switch (process.env.TRANSLATOR_PROVIDER) {
    case "google":
      return new GoogleTranslator();
    case "deepl":
      return new DeepLTranslator();
    default:
      return new FakeTranslator();
  }
}
