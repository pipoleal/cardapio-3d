import "server-only";
import { FakeTranslator } from "./fake";
import { GoogleTranslator } from "./google";
import type { Translator } from "./provider";

export type { Translator } from "./provider";

/** `TRANSLATOR_PROVIDER=google` usa a Cloud Translation API de verdade; qualquer outro valor (ou ausente) cai no fake — esse é o padrão em dev. */
export function getTranslator(): Translator {
  return process.env.TRANSLATOR_PROVIDER === "google" ? new GoogleTranslator() : new FakeTranslator();
}
