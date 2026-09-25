import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { parseMeshyTaskResponse, type MeshyTaskResponse } from "@/lib/three-d/meshy";
import { applyModelTaskResult } from "@/lib/three-d/jobs";
import type { ModelTaskResult } from "@/lib/three-d/provider";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Finaliza um job assim que o provider termina, sem esperar o próximo
 * `ModelJobsPoller` — o polling (`GET /api/models/[jobId]`) continua
 * existindo como fallback (nem toda config de produção vai ter o webhook
 * ligado, e isso serve pro futuro worker 3D próprio também, não só pra
 * Meshy). Genérico por `[provider]` de propósito — cada provider valida
 * seu próprio segredo e sabe interpretar seu próprio formato de payload.
 *
 * **Meshy não assina/autentica webhooks** (confirmado em
 * docs.meshy.ai/en/api/webhooks — a doc não menciona nenhum header de
 * assinatura nem segredo compartilhado). A segurança fica por um segredo
 * na própria URL (query `?token=`), já que quem configura a URL completa
 * no dashboard da Meshy somos nós — padrão comum quando o provedor não
 * assina a requisição.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ provider: string }> }) {
  const { provider } = await props.params;

  const expectedSecret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
  if (!expectedSecret) return errorResponse("not_configured", `Webhook não configurado pro provider "${provider}".`, 404);
  if (request.nextUrl.searchParams.get("token") !== expectedSecret) {
    return errorResponse("forbidden", "Segredo inválido.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("invalid_body", "Corpo inválido.", 400);

  let providerTaskId: string | undefined;
  let result: ModelTaskResult;

  if (provider === "meshy") {
    // A doc da Meshy não dá um exemplo direto do payload do webhook, só diz
    // que é "o objeto da task" — o mesmo formato do GET, que já inclui um
    // id em algum campo. Tenta os nomes mais prováveis; se a Meshy usar
    // outro, ajustar aqui depois de inspecionar uma entrega real
    // (só dá pra configurar o webhook com uma URL https pública, então só
    // depois do deploy em staging).
    const data = body as MeshyTaskResponse & { task_id?: string; result?: string };
    providerTaskId = data.id ?? data.task_id ?? data.result;
    result = parseMeshyTaskResponse(data);
  } else {
    return errorResponse("unknown_provider", `Provider "${provider}" não suportado.`, 404);
  }

  if (!providerTaskId) return errorResponse("invalid_body", "Sem id da task no payload.", 400);

  // O payload não tem nosso tenantId/jobId — acha o job pelo id da task do
  // provider (collection group query, índice em firestore.indexes.json).
  const jobsSnap = await adminDb
    .collectionGroup("modelJobs")
    .where("providerTaskId", "==", providerTaskId)
    .limit(1)
    .get();
  if (jobsSnap.empty) return errorResponse("not_found", "Job não encontrado pra essa task.", 404);

  const jobDoc = jobsSnap.docs[0]!;
  if (jobDoc.data().provider !== provider) {
    return errorResponse("not_found", "Job encontrado, mas de outro provider.", 404);
  }
  const tenantId = jobDoc.ref.parent.parent!.id;

  const applied = await applyModelTaskResult(tenantId, jobDoc.id, result);
  return NextResponse.json(applied);
}
