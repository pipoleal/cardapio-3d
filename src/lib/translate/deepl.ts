import "server-only";
import type { Translator } from "./provider";

const API_URL = "https://api-free.deepl.com/v2/translate";

// DeepL exige variante no idioma de DESTINO (não no de origem) — "EN"
// sozinho é aceito mas desencorajado pela doc; "PT" sozinho só vale como
// origem (nosso caso, origem é sempre pt).
const TARGET_LANG: Record<"en" | "es", string> = { en: "EN-US", es: "ES" };

type DeepLResponse = { translations: { text: string }[] };

/**
 * Plano grátis do DeepL ("DeepL API Free", deepl.com/pro-api) — até 500 mil
 * caracteres/mês, sem cartão de crédito nem CNPJ pra criar a conta
 * (alternativa ao Google Cloud Translation, que exige faturamento — ver
 * docs/DECISOES.md). Chave do plano grátis só funciona no endpoint
 * "api-free.deepl.com" (o plano pago usa "api.deepl.com"), mesmo formato
 * de autenticação nos dois (`Authorization: DeepL-Auth-Key <chave>`).
 */
export class DeepLTranslator implements Translator {
  async translateFields(
    fields: Record<string, string>,
    target: "en" | "es",
  ): Promise<Record<string, string>> {
    const keys = Object.keys(fields);
    if (keys.length === 0) return {};

    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      throw new Error("Falta DEEPL_API_KEY no ambiente pra usar o DeepLTranslator.");
    }

    const values = keys.map((key) => fields[key]!);
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: values, source_lang: "PT", target_lang: TARGET_LANG[target] }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`DeepL respondeu ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as DeepLResponse;
    return Object.fromEntries(keys.map((key, index) => [key, data.translations[index]?.text ?? fields[key]!]));
  }
}
