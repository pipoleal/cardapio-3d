import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getStorageProvider } from "@/lib/storage";
import { finalizeModelOutputs } from "./finalize";
import type { ModelTaskResult } from "./provider";

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

/** Exportado pra `lib/actions/products.ts` reaproveitar no upload manual de modelo 3D. */
export async function deleteOldModelFiles(previousModel: Record<string, unknown> | undefined): Promise<void> {
  if (!previousModel) return;
  const storage = getStorageProvider();
  const glbPath = previousModel.glbPath as string | undefined;
  const usdzPath = previousModel.usdzPath as string | undefined;
  await Promise.all([
    glbPath ? storage.delete(glbPath, { access: "public" }) : null,
    usdzPath ? storage.delete(usdzPath, { access: "public" }) : null,
  ]);
  // poster não tem path salvo separado hoje (só posterUrl) — fica órfão no
  // storage; sem custo real (é um SVG/PNG pequeno), fora do escopo por ora.
}

/**
 * Aplica o resultado de `provider.getTask()` ao job e ao produto — a
 * mesma lógica tanto pra quando o `ModelJobsPoller` sonda (`GET
 * /api/models/[jobId]`) quanto pro webhook do provider (`POST
 * /api/models/webhook/[provider]`), pra nunca ter dois lugares fazendo a
 * finalização de um jeito ligeiramente diferente. Idempotente: transação
 * com a flag `finalizing` garante que só uma chamada concorrente baixa e
 * sobe os arquivos (docs/PIPELINE-3D.md, "Idempotência") — então não tem
 * problema o polling e o webhook chegarem quase juntos.
 */
export async function applyModelTaskResult(
  tenantId: string,
  jobId: string,
  result: ModelTaskResult,
): Promise<{ status: ModelTaskResult["status"]; progress: number }> {
  const jobRef = adminDb.collection("tenants").doc(tenantId).collection("modelJobs").doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw new Error(`Job ${jobId} não encontrado (tenant ${tenantId}).`);
  const job = jobSnap.data()!;
  const productId = job.productId as string;
  const productRef = adminDb.collection("tenants").doc(tenantId).collection("products").doc(productId);

  if (job.status === "succeeded" || job.status === "failed") {
    return { status: job.status, progress: 100 };
  }

  if (result.status === "succeeded" && result.outputs) {
    const shouldFinalize = await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(jobRef);
      const freshData = fresh.data();
      if (!freshData || freshData.finalizing || freshData.status === "succeeded") return false;
      tx.update(jobRef, { finalizing: true });
      return true;
    });

    if (shouldFinalize) {
      const productSnap = await productRef.get();
      const previousModel = productSnap.data()?.model as Record<string, unknown> | undefined;

      const finalized = await finalizeModelOutputs(tenantId, productId, result.outputs);
      const creditPriceCents = Number(process.env.MESHY_CREDIT_PRICE_CENTS ?? 0);
      const costCents = result.consumedCredits ? Math.round(result.consumedCredits * creditPriceCents) : 0;

      await jobRef.update({
        status: "succeeded",
        progress: 100,
        finalizing: false,
        finishedAt: FieldValue.serverTimestamp(),
      });
      await productRef.update({
        model: {
          status: "ready",
          glbUrl: finalized.glbUrl,
          glbPath: finalized.glbPath,
          ...(finalized.usdzUrl ? { usdzUrl: finalized.usdzUrl, usdzPath: finalized.usdzPath } : {}),
          ...(finalized.posterUrl ? { posterUrl: finalized.posterUrl } : {}),
          jobId,
          route: "photos_ai",
          costCents,
          fileSizeBytes: finalized.fileSizeBytes,
          updatedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
      revalidateTag(`tenant:${tenantId}`, "max");
      await deleteOldModelFiles(previousModel);
    }

    return { status: "succeeded", progress: 100 };
  }

  if (result.status === "failed") {
    await jobRef.update({
      status: "failed",
      error: result.error ?? "Falhou no provedor.",
      finishedAt: FieldValue.serverTimestamp(),
    });
    await productRef.update({ "model.status": "failed", updatedAt: FieldValue.serverTimestamp() });
    revalidateTag(`tenant:${tenantId}`, "max");
    return { status: "failed", progress: 0 };
  }

  // Ainda processando — só atualiza o progresso (sem revalidar a cada
  // sondagem, seria barulho demais).
  await jobRef.update({ status: result.status, progress: result.progress });
  return { status: result.status, progress: result.progress };
}
