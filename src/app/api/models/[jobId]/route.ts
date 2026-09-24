import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { getTenantBySlug } from "@/lib/tenant";
import { finalizeModelOutputs } from "@/lib/three-d/finalize";
import { getModelProvider } from "@/lib/three-d";

const STALE_MS = 24 * 60 * 60 * 1000;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Sondagem: quem avança o pipeline de verdade — sem isso rodando, um job
 * na Meshy fica pronto e a gente nunca fica sabendo (não tem webhook
 * configurado ainda, ver docs/ROADMAP.md Etapa 7). Chamado pelo
 * `ModelJobsPoller` (roda em qualquer página do painel, não só na do
 * produto) a cada poucos segundos enquanto o job estiver "processing".
 */
export async function GET(request: NextRequest, props: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await props.params;
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!tenantSlug) return errorResponse("invalid_request", "tenantSlug é obrigatório.", 400);

  const user = await getSessionUser();
  if (!user) return errorResponse("unauthenticated", "Sem sessão.", 401);

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return errorResponse("not_found", "Loja não encontrada.", 404);
  if (!user.isSuperadmin && !tenant.ownerUids.includes(user.uid)) {
    return errorResponse("forbidden", "Sem permissão nesta loja.", 403);
  }

  const jobRef = adminDb.collection("tenants").doc(tenant.id).collection("modelJobs").doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) return errorResponse("not_found", "Job não encontrado.", 404);
  const job = jobSnap.data()!;

  if (job.status === "succeeded" || job.status === "failed") {
    return NextResponse.json({ status: job.status, progress: 100 });
  }

  const createdAtMs = (job.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
  if (Date.now() - createdAtMs > STALE_MS) {
    await jobRef.update({
      status: "failed",
      error: "Expirou (mais de 24h processando).",
      finishedAt: FieldValue.serverTimestamp(),
    });
    await adminDb.collection("tenants").doc(tenant.id).collection("products").doc(job.productId as string).update({
      "model.status": "failed",
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTag(`tenant:${tenant.id}`, "max");
    return NextResponse.json({ status: "failed", progress: 0 });
  }

  const provider = getModelProvider();
  const result = await provider.getTask(job.providerTaskId as string);

  if (result.status === "succeeded" && result.outputs) {
    // Transação: só quem consegue virar `finalizing` de false->true baixa
    // e sobe os arquivos — evita duas sondagens simultâneas duplicando o
    // trabalho (docs/PIPELINE-3D.md, "Idempotência").
    const shouldFinalize = await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(jobRef);
      const freshData = fresh.data();
      if (!freshData || freshData.finalizing || freshData.status === "succeeded") return false;
      tx.update(jobRef, { finalizing: true });
      return true;
    });

    if (shouldFinalize) {
      const finalized = await finalizeModelOutputs(tenant.id, job.productId as string, result.outputs);
      const creditPriceCents = Number(process.env.MESHY_CREDIT_PRICE_CENTS ?? 0);
      const costCents = result.consumedCredits ? Math.round(result.consumedCredits * creditPriceCents) : 0;

      await jobRef.update({
        status: "succeeded",
        progress: 100,
        finalizing: false,
        finishedAt: FieldValue.serverTimestamp(),
      });
      await adminDb.collection("tenants").doc(tenant.id).collection("products").doc(job.productId as string).update({
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
      revalidateTag(`tenant:${tenant.id}`, "max");
    }

    return NextResponse.json({ status: "succeeded", progress: 100 });
  }

  if (result.status === "failed") {
    await jobRef.update({
      status: "failed",
      error: result.error ?? "Falhou no provedor.",
      finishedAt: FieldValue.serverTimestamp(),
    });
    await adminDb.collection("tenants").doc(tenant.id).collection("products").doc(job.productId as string).update({
      "model.status": "failed",
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTag(`tenant:${tenant.id}`, "max");
    return NextResponse.json({ status: "failed", progress: 0 });
  }

  // Ainda processando — só atualiza o progresso (sem revalidar a cada
  // sondagem, seria barulho demais).
  await jobRef.update({ status: result.status, progress: result.progress });
  return NextResponse.json({ status: result.status, progress: result.progress });
}
