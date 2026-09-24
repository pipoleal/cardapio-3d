import "server-only";
import { Translate } from "@google-cloud/translate/build/src/v2";
import type { Translator } from "./provider";

function createClient(): Translate {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltam variáveis do Admin SDK em .env.local pra usar o GoogleTranslator (mesma credencial do Firebase Admin).",
    );
  }

  return new Translate({ projectId, credentials: { client_email: clientEmail, private_key: privateKey } });
}

/**
 * Cloud Translation API — reaproveita a MESMA conta de serviço do Firebase
 * Admin SDK (precisa ter a Cloud Translation API habilitada nesse projeto
 * GCP). Ver `.env.example`, `TRANSLATOR_PROVIDER=google`.
 */
export class GoogleTranslator implements Translator {
  async translateFields(
    fields: Record<string, string>,
    target: "en" | "es",
  ): Promise<Record<string, string>> {
    const keys = Object.keys(fields);
    if (keys.length === 0) return {};

    const translate = createClient();
    const values = keys.map((key) => fields[key]!);
    const [translations] = await translate.translate(values, { from: "pt", to: target });
    const translatedValues = Array.isArray(translations) ? translations : [translations];

    return Object.fromEntries(keys.map((key, index) => [key, translatedValues[index]!]));
  }
}
