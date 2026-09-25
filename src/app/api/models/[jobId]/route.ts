import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { getTenantBySlug } from "@/lib/tenant";
import { applyModelTaskResult } from "@/lib/three-d/jobs";
import { getModelProvider } from "@/lib/three-d";

const STALE_MS = 24 * 60 * 60 * 1000;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Sondagem: o fallback que sempre funciona, mesmo sem webhook configurado
 * (`POST /api/models/webhook/[provider]`, docs/PIPELINE-3D.md) — chamado
 * pelo `ModelJobsPoller` (roda em qualquer página do painel, não só na do
 * produto) a cada poucos segundos enquanto o job estiver "processing". A
 * finalização de verdade (baixar da Meshy, subir pro nosso storage) mora
 * em `lib/three-d/jobs.ts`, compartilhada com o webhook.
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
  const applied = await applyModelTaskResult(tenant.id, jobId, result);

  return NextResponse.json(applied);
}
