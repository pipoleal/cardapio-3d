"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setProductModelUpload } from "@/lib/actions/products";
import { db } from "@/lib/firebase/client";
import { formatPriceCents } from "@/lib/price";
import type { Product } from "@/lib/schemas/product";
import { uploadFile } from "@/lib/storage/upload-client";

type Model = Product["model"];

const STATUS_LABEL: Record<Model["status"], string> = {
  none: "Sem captura",
  processing: "Processando",
  ready: "Pronto",
  failed: "Falhou",
};

const ROUTE_LABEL: Record<NonNullable<Model["route"]>, string> = {
  photos_ai: "Fotos (IA)",
  video_scan: "Vídeo (escaneamento)",
  upload: "Upload manual",
};

// Mesmo limite do token gerado em /api/blob/upload/public/route.ts —
// checagem no cliente só evita mandar um arquivo grande à toa; o servidor
// já recusa de novo se driblar isso.
const MAX_MODEL_BYTES = 50 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Status ao vivo do modelo 3D — escuta o doc do produto com `onSnapshot`
 * (leitura pública, ver firestore.rules) pra atualizar assim que o
 * `ModelJobsPoller` (montado no layout do painel) finalizar o job, sem
 * esperar o próprio poll deste componente nem um refresh manual.
 */
export function Model3DStatus({
  tenantId,
  tenantSlug,
  productId,
  initialModel,
}: {
  tenantId: string;
  tenantSlug: string;
  productId: string;
  initialModel: Model;
}) {
  const [model, setModel] = useState<Model>(initialModel);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const glbInputRef = useRef<HTMLInputElement>(null);
  const usdzInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ref = doc(db, "tenants", tenantId, "products", productId);
    return onSnapshot(ref, (snap) => {
      const data = snap.data() as { model?: Model } | undefined;
      if (data?.model) setModel(data.model);
    });
  }, [tenantId, productId]);

  const hasAndroid = Boolean(model.glbUrl);
  const hasUsdz = Boolean(model.usdzUrl);
  const captureHref = `/painel/${tenantSlug}/captura?produto=${productId}`;

  async function handleUploadSubmit() {
    const glbFile = glbInputRef.current?.files?.[0];
    const usdzFile = usdzInputRef.current?.files?.[0];
    setUploadError(null);

    if (!glbFile || !glbFile.name.toLowerCase().endsWith(".glb")) {
      setUploadError("Selecione um arquivo .glb.");
      return;
    }
    if (glbFile.size > MAX_MODEL_BYTES) {
      setUploadError("Arquivo .glb maior que 50 MB.");
      return;
    }
    if (usdzFile) {
      if (!usdzFile.name.toLowerCase().endsWith(".usdz")) {
        setUploadError("O arquivo opcional precisa ser .usdz.");
        return;
      }
      if (usdzFile.size > MAX_MODEL_BYTES) {
        setUploadError("Arquivo .usdz maior que 50 MB.");
        return;
      }
    }

    setUploading(true);
    try {
      const glbPath = `tenants/${tenantId}/products/${productId}/models/model.glb`;
      const glb = await uploadFile(glbPath, glbFile, {
        contentType: "model/gltf-binary",
        access: "public",
      });

      let usdz: { url: string; path: string } | undefined;
      if (usdzFile) {
        const usdzPath = `tenants/${tenantId}/products/${productId}/models/model.usdz`;
        usdz = await uploadFile(usdzPath, usdzFile, {
          contentType: "model/vnd.usdz+zip",
          access: "public",
        });
      }

      await setProductModelUpload(tenantId, productId, {
        glbUrl: glb.url,
        glbPath: glb.path,
        usdzUrl: usdz?.url,
        usdzPath: usdz?.path,
        fileSizeBytes: glbFile.size,
      });

      setShowUploadForm(false);
      if (glbInputRef.current) glbInputRef.current.value = "";
      if (usdzInputRef.current) usdzInputRef.current.value = "";
    } catch {
      setUploadError("Não foi possível enviar o modelo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">Modelo 3D</h2>
        <span className="rounded-full bg-bg px-3 py-1 text-xs font-medium text-muted">
          {STATUS_LABEL[model.status]}
        </span>
      </div>

      {model.status === "ready" && (
        <dl className="flex flex-col gap-1 text-xs text-muted">
          {model.route && (
            <div className="flex justify-between">
              <dt>Rota</dt>
              <dd>{ROUTE_LABEL[model.route]}</dd>
            </div>
          )}
          {typeof model.costCents === "number" && (
            <div className="flex justify-between">
              <dt>Custo</dt>
              <dd>{formatPriceCents(model.costCents, "pt")}</dd>
            </div>
          )}
          {typeof model.fileSizeBytes === "number" && (
            <div className="flex justify-between">
              <dt>Tamanho</dt>
              <dd>{formatFileSize(model.fileSizeBytes)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>AR compatível</dt>
            <dd>
              {hasAndroid
                ? hasUsdz
                  ? "Android e iPhone"
                  : "Android e iPhone (USDZ automático pelo Safari)"
                : "—"}
            </dd>
          </div>
        </dl>
      )}

      {model.status === "processing" && (
        <p className="text-xs text-muted">
          Gerando o modelo 3D — isso pode levar alguns minutos. Pode navegar pra outras telas do
          painel, a captura continua em segundo plano.
        </p>
      )}

      {model.status === "failed" && (
        <p className="text-xs text-rec">Não foi possível gerar o modelo. Tente refazer a captura.</p>
      )}

      {model.status !== "processing" && (
        <>
          <Link
            href={captureHref}
            className="inline-flex min-h-11 items-center justify-center rounded-input border border-border text-sm font-medium text-ink hover:bg-bg"
          >
            {model.status === "none" ? "Gerar por fotos (IA)" : "Refazer captura"}
          </Link>

          {!showUploadForm ? (
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-input border border-border text-sm font-medium text-ink hover:bg-bg"
            >
              Subir meu modelo
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-input border border-border p-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Arquivo .glb (obrigatório)
                <input ref={glbInputRef} type="file" accept=".glb" className="text-xs" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Arquivo .usdz — opcional. O Safari do iPhone já converte o .glb pra AR
                automaticamente; envie o seu só se quiser mais controle sobre o resultado.
                <input ref={usdzInputRef} type="file" accept=".usdz" className="text-xs" />
              </label>
              {uploadError && <p className="text-xs text-rec">{uploadError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void handleUploadSubmit()}
                  className="min-h-9 flex-1 rounded-input bg-accent text-xs font-semibold text-surface disabled:opacity-50"
                >
                  {uploading ? "Enviando..." : "Enviar"}
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setShowUploadForm(false)}
                  className="min-h-9 flex-1 rounded-input border border-border text-xs font-medium text-ink"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
