"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateTenantSettings, type TenantSettingsInput } from "@/lib/actions/tenant";
import type { Locale, WhatsappMode } from "@/lib/schemas/common";

const MODE_LABEL: Record<WhatsappMode, string> = {
  discreet: "Discreto (sem botão fixo)",
  prominent: "Chamativo (botão fixo)",
  off: "Desligado (nenhum WhatsApp)",
};

export function TenantSettingsForm({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: TenantSettingsInput;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TenantSettingsInput>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function toggleLocale(locale: Exclude<Locale, "pt">) {
    setValues((current) => {
      const set = new Set(current.extraLocales);
      if (set.has(locale)) set.delete(locale);
      else set.add(locale);
      return { ...current, extraLocales: Array.from(set) };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSavedAt(null);
    try {
      await updateTenantSettings(tenantId, values);
      setSavedAt(Date.now());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-1 text-sm">
          Nome da loja
          <input
            required
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            className="min-h-11 rounded-input border border-border bg-surface px-3 text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          WhatsApp (DDI + DDD + número, só dígitos)
          <input
            required
            value={values.whatsapp}
            onChange={(event) => setValues((current) => ({ ...current, whatsapp: event.target.value }))}
            placeholder="5511999999999"
            className="min-h-11 rounded-input border border-border bg-surface px-3 text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Modo do botão do WhatsApp
          <select
            value={values.whatsappMode}
            onChange={(event) =>
              setValues((current) => ({ ...current, whatsappMode: event.target.value as WhatsappMode }))
            }
            className="min-h-11 rounded-input border border-border bg-surface px-3 text-ink"
          >
            {(Object.keys(MODE_LABEL) as WhatsappMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {MODE_LABEL[mode]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {"Mensagem do WhatsApp (use {produto} e {variacao})"}
          <textarea
            rows={2}
            value={values.whatsappTemplate ?? ""}
            onChange={(event) => setValues((current) => ({ ...current, whatsappTemplate: event.target.value }))}
            className="rounded-input border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <p className="text-sm font-medium text-ink">Idiomas ativos</p>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked disabled /> Português (sempre ativo)
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={values.extraLocales.includes("en")}
            onChange={() => toggleLocale("en")}
          />
          Inglês
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={values.extraLocales.includes("es")}
            onChange={() => toggleLocale("es")}
          />
          Espanhol
        </label>
      </Card>

      <Card className="flex items-center gap-3 p-5">
        <label className="flex items-center gap-3 text-sm text-ink">
          Cor principal
          <input
            type="color"
            value={values.themePrimary}
            onChange={(event) => setValues((current) => ({ ...current, themePrimary: event.target.value }))}
            className="h-10 w-16 rounded-input border border-border"
          />
        </label>
        <span className="text-sm text-muted">{values.themePrimary}</span>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          Salvar
        </Button>
        {savedAt && <span className="text-sm text-success">Salvo!</span>}
      </div>
    </form>
  );
}
