import { Timestamp } from "firebase-admin/firestore";

/**
 * Funções com `'use cache'` só podem devolver valores serializáveis
 * (Date é suportado, instâncias de classe como `Timestamp` não são) — ver
 * node_modules/next/dist/docs/.../use-cache.md, "Serialization". Por isso
 * convertemos `Timestamp` → `Date` assim que lemos do Firestore, antes de
 * validar com zod (cujos schemas usam `z.date()`, não `z.instanceof(Timestamp)`).
 */
export function toDate(value: unknown): Date | undefined {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return undefined;
}
