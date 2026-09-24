"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { formatPriceCents } from "@/lib/price";
import type { Product } from "@/lib/schemas/product";

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
};

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

  useEffect(() => {
    const ref = doc(db, "tenants", tenantId, "products", productId);
    return onSnapshot(ref, (snap) => {
      const data = snap.data() as { model?: Model } | undefined;
      if (data?.model) setModel(data.model);
    });
  }, [tenantId, productId]);

  const hasAndroid = Boolean(model.glbUrl);
  const hasIos = Boolean(model.usdzUrl);
  const captureHref = `/painel/${tenantSlug}/captura?produto=${productId}`;

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
            <dd>{hasIos ? "Android e iPhone" : hasAndroid ? "Android" : "—"}</dd>
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
        <Link
          href={captureHref}
          className="inline-flex min-h-11 items-center justify-center rounded-input border border-border text-sm font-medium text-ink hover:bg-bg"
        >
          {model.status === "none" ? "Gerar por fotos (IA)" : "Refazer captura"}
        </Link>
      )}
    </div>
  );
}
