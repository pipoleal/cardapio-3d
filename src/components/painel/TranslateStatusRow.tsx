"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { approveTranslation, translateEntity } from "@/lib/actions/translate";
import type { I18nFieldStatus } from "@/lib/schemas/common";

type Kind = "tenant" | "category" | "product";
type Target = "en" | "es";

// Linha da tela "Traduções" (uma entidade, os 2 idiomas de destino lado a
// lado) — a versão compacta do que o TranslationsCard mostra por inteiro
// na tela de editar produto.
export function TranslateStatusRow({
  tenantId,
  kind,
  entityId,
  label,
  status,
}: {
  tenantId: string;
  kind: Kind;
  entityId: string;
  label: string;
  status?: { en?: I18nFieldStatus; es?: I18nFieldStatus };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Target | null>(null);

  async function act(target: Target, action: "translate" | "approve") {
    setPending(target);
    try {
      if (action === "translate") await translateEntity(tenantId, kind, entityId, target);
      else await approveTranslation(tenantId, kind, entityId, target);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex gap-5">
        {(["en", "es"] as const).map((target) => {
          const fieldStatus = status?.[target];
          const busy = pending === target;
          return (
            <div key={target} className="flex items-center gap-2 text-xs">
              <span className="font-medium text-muted">{target.toUpperCase()}</span>
              <span
                className={
                  fieldStatus === "approved"
                    ? "text-success"
                    : fieldStatus === "auto"
                      ? "text-warning"
                      : "text-muted"
                }
              >
                {fieldStatus === "approved" ? "Aprovado" : fieldStatus === "auto" ? "Traduzido" : "Pendente"}
              </span>
              {fieldStatus === "auto" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(target, "approve")}
                  className="text-accent underline disabled:opacity-50"
                >
                  Aprovar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(target, "translate")}
                  className="text-accent underline disabled:opacity-50"
                >
                  {fieldStatus === "approved" ? "Traduzir de novo" : "Traduzir"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
