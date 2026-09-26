"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { ALLERGENS, ALLERGEN_LABELS } from "@/lib/allergens";
import {
  createProduct,
  deleteProduct,
  setProductFresh,
  updateProduct,
  type ProductInput,
} from "@/lib/actions/products";
import type { Allergen } from "@/lib/schemas/common";
import { buildTenantOrigin } from "@/lib/tenant-host";

type CategoryOption = { id: string; name: string };

export type ProductFormValues = ProductInput & { id?: string };

// Espelha o card "Informações" do mockup 05, com o cabeçalho (breadcrumb,
// "Ver no cardápio", "Salvar e publicar") junto — o botão de salvar precisa
// do estado do formulário, por isso fica tudo num componente client só.
export function ProductForm({
  tenantId,
  tenantSlug,
  categories,
  initial,
  categoryName,
  freshInitially,
}: {
  tenantId: string;
  tenantSlug: string;
  categories: CategoryOption[];
  initial: ProductFormValues;
  categoryName: string;
  freshInitially: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(freshInitially);
  const [freshPending, setFreshPending] = useState(false);

  async function handleFreshToggle(checked: boolean) {
    if (!values.id) return;
    setFresh(checked);
    setFreshPending(true);
    try {
      await setProductFresh(tenantId, values.id, checked);
      router.refresh();
    } finally {
      setFreshPending(false);
    }
  }

  const isNew = !values.id;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const pathTenantMode = process.env.NEXT_PUBLIC_PATH_TENANT_MODE === "true";
  const productUrl = `${buildTenantOrigin(tenantSlug, rootDomain, pathTenantMode)}/p/${values.id}`;

  function toggleAllergen(list: "allergens" | "mayContain", allergen: Allergen) {
    setValues((current) => {
      const set = new Set(current[list] ?? []);
      if (set.has(allergen)) set.delete(allergen);
      else set.add(allergen);
      return { ...current, [list]: Array.from(set) };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input: ProductInput = {
        categoryId: values.categoryId,
        name: values.name,
        description: values.description || undefined,
        priceCents: values.priceCents,
        servings: values.servings,
        allergens: values.allergens,
        mayContain: values.mayContain,
        available: values.available,
        acceptsOrders: values.acceptsOrders,
      };

      if (values.id) {
        await updateProduct(tenantId, values.id, input);
        router.refresh();
      } else {
        const newId = await createProduct(tenantId, input);
        router.push(`/painel/${tenantSlug}/produtos/${newId}`);
      }
    } catch {
      setError("Não foi possível salvar. Confira os campos e tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!values.id) return;
    if (!confirm("Apagar este produto? Essa ação não pode ser desfeita.")) return;
    setSaving(true);
    try {
      await deleteProduct(tenantId, values.id);
      router.push(`/painel/${tenantSlug}/produtos`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            Produtos / {categoryName}
          </p>
          <h1 className="font-heading text-2xl font-semibold text-ink">
            {values.name || "Novo produto"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-cta border border-ink px-5 text-sm font-medium text-ink hover:bg-bg"
            >
              Ver no cardápio
            </a>
          )}
          <Button type="submit" disabled={saving}>
            {isNew ? "Criar produto" : "Salvar e publicar"}
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-heading text-lg font-semibold text-ink">Informações</h2>

        <label className="flex flex-col gap-1 text-sm">
          Nome
          <input
            required
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            className="min-h-11 rounded-input border border-border bg-surface px-3 text-ink"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Categoria
            <select
              value={values.categoryId}
              onChange={(event) => setValues((current) => ({ ...current, categoryId: event.target.value }))}
              className="min-h-11 rounded-input border border-border bg-surface px-3 text-ink"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Preço (R$)
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={(values.priceCents / 100).toFixed(2)}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  priceCents: Math.round(Number(event.target.value || 0) * 100),
                }))
              }
              className="min-h-11 rounded-input border border-border bg-surface px-3 text-ink"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Descrição
          <textarea
            rows={3}
            value={values.description ?? ""}
            onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
            className="rounded-input border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Alergênicos</p>
          <div className="grid grid-cols-3 gap-2">
            {ALLERGENS.map((allergen) => (
              <label key={allergen} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={values.allergens.includes(allergen)}
                  onChange={() => toggleAllergen("allergens", allergen)}
                />
                {ALLERGEN_LABELS[allergen].pt}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Pode conter traços de</p>
          <div className="grid grid-cols-3 gap-2">
            {ALLERGENS.map((allergen) => (
              <label key={allergen} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={(values.mayContain ?? []).includes(allergen)}
                  onChange={() => toggleAllergen("mayContain", allergen)}
                />
                {ALLERGEN_LABELS[allergen].pt}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 border-t border-border pt-4">
          <Toggle
            label="Esgotado hoje"
            checked={!values.available}
            onCheckedChange={(checked) => setValues((current) => ({ ...current, available: !checked }))}
          />
          <Toggle
            label="Saiu do forno"
            checked={fresh}
            onCheckedChange={handleFreshToggle}
            disabled={isNew || freshPending}
          />
          <Toggle
            label="Aceita encomenda"
            checked={values.acceptsOrders}
            onCheckedChange={(checked) => setValues((current) => ({ ...current, acceptsOrders: checked }))}
          />
        </div>

        {error && <p className="text-sm text-rec">{error}</p>}

        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            className="self-start text-sm text-rec hover:underline"
          >
            Apagar produto
          </button>
        )}
      </Card>
    </form>
  );
}
