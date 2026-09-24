import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { getTenantBySlug } from "@/lib/tenant";
import { resolveInputImageUrls } from "@/lib/three-d/input-images";
import { getModelProvider } from "@/lib/three-d";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Cria um job de geração 3D — chamado pelo assistente de captura depois
 * de subir as fotos pro Storage (SDK web). Ver docs/PIPELINE-3D.md.
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const { tenantSlug, productId, inputPaths } = (body ?? {}) as {
    tenantSlug?: string;
    productId?: string;
    inputPaths?: string[];
  };

  if (!tenantSlug || !productId || !inputPaths?.length) {
    return errorResponse("invalid_request", "tenantSlug, productId e inputPaths são obrigatórios.", 400);
  }

  const user = await getSessionUser();
  if (!user) return errorResponse("unauthenticated", "Sem sessão.", 401);

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return errorResponse("not_found", "Loja não encontrada.", 404);
  if (!user.isSuperadmin && !tenant.ownerUids.includes(user.uid)) {
    return errorResponse("forbidden", "Sem permissão nesta loja.", 403);
  }

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const jobsThisMonth = await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .collection("modelJobs")
    .where("createdAt", ">=", startOfMonth)
    .count()
    .get();
  if (jobsThisMonth.data().count >= tenant.limits.modelsPerMonth) {
    return errorResponse(
      "limit_reached",
      `Limite de ${tenant.limits.modelsPerMonth} modelos por mês atingido.`,
      403,
    );
  }

  const imageUrls = await resolveInputImageUrls(inputPaths);
  const provider = getModelProvider();
  const { taskId } = await provider.createTask({ imageUrls });

  const jobRef = adminDb.collection("tenants").doc(tenant.id).collection("modelJobs").doc();
  await jobRef.set({
    productId,
    provider: provider.name,
    providerTaskId: taskId,
    mode: inputPaths.length > 1 ? "multi" : "single",
    inputPaths,
    status: "processing",
    progress: 0,
    target: "model",
    createdBy: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  await adminDb.collection("tenants").doc(tenant.id).collection("products").doc(productId).update({
    "model.status": "processing",
    "model.jobId": jobRef.id,
    "model.route": "photos_ai",
    updatedAt: FieldValue.serverTimestamp(),
  });
  revalidateTag(`tenant:${tenant.id}`, "max");

  return NextResponse.json({ jobId: jobRef.id }, { status: 202 });
}
