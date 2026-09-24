"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { pillClassName } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { approveTranslation, translateEntity } from "@/lib/actions/translate";
import type { I18nFieldStatus } from "@/lib/schemas/common";

type Locale = "pt" | "en" | "es";
type LocalizedValue = { pt: string; en?: string; es?: string };

const LOCALE_LABEL: Record<"en" | "es", string> = { en: "inglês", es: "espanhol" };

// Espelha o card "Traduções" do mockup 05: abas PT/EN/ES, aviso de
// "traduzido automaticamente", campos (só leitura — editar o texto
// traduzido direto não está no mockup, só aprovar/traduzir de novo).
export function TranslationsCard({
  tenantId,
  kind,
  entityId,
  name,
  description,
  i18nStatus,
}: {
  tenantId: string;
  kind: "tenant" | "category" | "product";
  entityId: string;
  name: LocalizedValue;
  description?: LocalizedValue;
  i18nStatus?: { en?: I18nFieldStatus; es?: I18nFieldStatus };
}) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("pt");
  const [pending, setPending] = useState(false);

  async function handleTranslate(target: "en" | "es") {
    setPending(true);
    try {
      await translateEntity(tenantId, kind, entityId, target);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleApprove(target: "en" | "es") {
    setPending(true);
    try {
      await approveTranslation(tenantId, kind, entityId, target);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const status = locale !== "pt" ? i18nStatus?.[locale] : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">Traduções</h2>
        <div className="flex gap-1">
          {(["pt", "en", "es"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLocale(option)}
              className={pillClassName(locale === option)}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {locale !== "pt" && (
        <p
          className={
            status === "approved"
              ? "rounded-input bg-bg px-3 py-2 text-xs text-success"
              : "rounded-input bg-bg px-3 py-2 text-xs text-warning"
          }
        >
          {status === "approved"
            ? "Aprovado"
            : status === "auto"
              ? "Traduzido automaticamente · revise antes de aprovar"
              : "Ainda não traduzido"}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Nome{locale !== "pt" ? ` (${LOCALE_LABEL[locale]})` : ""}
        <input
          readOnly
          value={locale === "pt" ? name.pt : (name[locale] ?? "")}
          className="min-h-11 rounded-input border border-border bg-bg px-3 text-ink"
        />
      </label>

      {description && (
        <label className="flex flex-col gap-1 text-sm">
          Descrição{locale !== "pt" ? ` (${LOCALE_LABEL[locale]})` : ""}
          <textarea
            readOnly
            rows={2}
            value={locale === "pt" ? description.pt : (description[locale] ?? "")}
            className="rounded-input border border-border bg-bg px-3 py-2 text-ink"
          />
        </label>
      )}

      {locale !== "pt" && (
        <div className="flex gap-2">
          <Button type="button" disabled={pending || status !== "auto"} onClick={() => handleApprove(locale)}>
            Aprovar tradução
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleTranslate(locale)}>
            Traduzir de novo
          </Button>
        </div>
      )}
    </div>
  );
}
