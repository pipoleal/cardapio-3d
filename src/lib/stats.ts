import "server-only";
import { FieldPath } from "firebase-admin/firestore";
import { DEFAULT_TIMEZONE, dateKeyInTimezone } from "./date-key";
import { adminDb } from "./firebase/admin";

function dateKeysBack(days: number, timeZone: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    keys.push(dateKeyInTimezone(date, timeZone));
  }
  return keys;
}

export type StatsSummary = {
  menuViews: number;
  modelOpens: number;
  arOpens: number;
  whatsappClicks: number; // soma de todo whatsapp_click, incluindo o CTA geral ("_geral")
  byProduct: Record<string, { views: number; modelOpens: number; arOpens: number; whatsappClicks: number }>;
  byLocale: Record<string, number>;
  byOrigin: Record<string, number>;
};

function emptySummary(): StatsSummary {
  return { menuViews: 0, modelOpens: 0, arOpens: 0, whatsappClicks: 0, byProduct: {}, byLocale: {}, byOrigin: {} };
}

function addToProduct(
  byProduct: StatsSummary["byProduct"],
  productId: string,
  field: "views" | "modelOpens" | "arOpens" | "whatsappClicks",
  amount: number,
) {
  byProduct[productId] ??= { views: 0, modelOpens: 0, arOpens: 0, whatsappClicks: 0 };
  byProduct[productId][field] += amount;
}

function sumRecord(target: Record<string, number>, source: Record<string, number> | undefined) {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[key] = (target[key] ?? 0) + (typeof value === "number" ? value : 0);
  }
}

/**
 * Soma os últimos `days` documentos `stats/{AAAA-MM-DD}` — por range de ID
 * do documento (a string ordena igual à data), sem precisar de índice
 * composto. Sempre dinâmico (sem `'use cache'`): o número muda a cada
 * visita do cardápio público, a Visão geral do painel já é uma rota
 * sempre-dinâmica como o resto do painel.
 */
export async function getStats(tenantId: string, days: 7 | 30): Promise<StatsSummary> {
  const keys = dateKeysBack(days, DEFAULT_TIMEZONE).sort();
  const startKey = keys[0]!;
  const endKey = keys[keys.length - 1]!;

  const statsRef = adminDb.collection("tenants").doc(tenantId).collection("stats");
  const snap = await statsRef
    .where(FieldPath.documentId(), ">=", startKey)
    .where(FieldPath.documentId(), "<=", endKey)
    .get();

  const summary = emptySummary();

  for (const doc of snap.docs) {
    const data = doc.data() as {
      menu_view?: number;
      product_view?: Record<string, number>;
      model_open?: Record<string, number>;
      ar_open?: Record<string, number>;
      whatsapp_click?: Record<string, number>;
      locale?: Record<string, number>;
      origin?: Record<string, number>;
    };

    summary.menuViews += data.menu_view ?? 0;

    for (const [productId, value] of Object.entries(data.product_view ?? {})) {
      addToProduct(summary.byProduct, productId, "views", value);
    }
    for (const [productId, value] of Object.entries(data.model_open ?? {})) {
      summary.modelOpens += value;
      addToProduct(summary.byProduct, productId, "modelOpens", value);
    }
    for (const [productId, value] of Object.entries(data.ar_open ?? {})) {
      summary.arOpens += value;
      addToProduct(summary.byProduct, productId, "arOpens", value);
    }
    for (const [productId, value] of Object.entries(data.whatsapp_click ?? {})) {
      summary.whatsappClicks += value;
      if (productId !== "_geral") addToProduct(summary.byProduct, productId, "whatsappClicks", value);
    }

    sumRecord(summary.byLocale, data.locale);
    sumRecord(summary.byOrigin, data.origin);
  }

  return summary;
}
