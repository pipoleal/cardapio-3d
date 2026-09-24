import "server-only";
import { adminDb } from "@/lib/firebase/admin";

export type ActiveModelJob = { jobId: string; productId: string };

/**
 * Sem `'use cache'`: chamado pelo layout do painel, em TODA página — quer
 * o estado mais fresco possível pra decidir se retoma a sondagem (ver
 * components/painel/ModelJobsPoller.tsx).
 */
export async function listActiveModelJobs(tenantId: string): Promise<ActiveModelJob[]> {
  const snap = await adminDb
    .collection("tenants")
    .doc(tenantId)
    .collection("modelJobs")
    .where("status", "in", ["queued", "processing"])
    .get();

  return snap.docs.map((doc) => ({ jobId: doc.id, productId: doc.data().productId as string }));
}
