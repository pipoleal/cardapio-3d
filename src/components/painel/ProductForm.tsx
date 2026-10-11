"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { ALLERGENS, ALLERGEN_LABELS } from "@/lib/allergens";
import {
  createProduct,
  deleteProduct,
  setProductCover,
  setProductFresh,
  updateProduct,
  type ProductInput,
} from "@/lib/actions/products";
import { compressImage } from "@/lib/image-compress";
import type { Allergen } from "@/lib/schemas/common";
import { uploadFile } from "@/lib/storage/upload-client";
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
  const { showSuccess, showError } = useToast();
  const [values, setValues] = useState<ProductFormValues>(initial);
  // Texto digitado no campo de preço, separado de `values.priceCents`: usar
  // `(priceCents / 100).toFixed(2)` direto como `value` reformata o campo a
  // CADA tecla — o cursor perde a posição e a digitação sai embaralhada
  // (ex.: tentar digitar "25.90" vira "2.02"). O texto só normaliza pra
  // "0.00" de novo ao sair do campo (blur); `priceCents` acompanha a cada
  // tecla, mas só quando o texto já forma um número válido.
  const [priceText, setPriceText] = useState(() => (initial.priceCents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(freshInitially);
  const [freshPending, setFreshPending] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Guarda síncrona contra duplo clique/duplo Enter: `saving` só reflete no
  // DOM (desabilita o botão) depois do próximo render, e um clique duplo
  // rápido o bastante disparava `createProduct` duas vezes antes disso.
  const submittingRef = useRef(false);
  // Foto escolhida ANTES do produto existir (fluxo de criação): só fica
  // guardada em memória (preview local) — o upload de verdade só acontece
  // depois que createProduct devolve o id, dentro do próprio handleSubmit.
  const [stagedCoverFile, setStagedCoverFile] = useState<File | null>(null);
  const [stagedCoverPreview, setStagedCoverPreview] = useState<string | null>(null);
  const stagedCoverInputRef = useRef<HTMLInputElement>(null);

  function handleStagedCoverFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (stagedCoverPreview) URL.revokeObjectURL(stagedCoverPreview);
    setStagedCoverFile(file);
    setStagedCoverPreview(URL.createObjectURL(file));
  }

  function handleRemoveStagedCover() {
    if (stagedCoverPreview) URL.revokeObjectURL(stagedCoverPreview);
    setStagedCoverFile(null);
    setStagedCoverPreview(null);
  }

  async function handleFreshToggle(checked: boolean) {
    if (!values.id) return;
    setFresh(checked);
    setFreshPending(true);
    try {
      await setProductFresh(tenantId, values.id, checked);
      router.refresh();
    } catch {
      setFresh(!checked); // volta pro estado anterior — a gravação não aconteceu.
      showError("Não foi possível atualizar 'Saiu do forno'.");
    } finally {
      setFreshPending(false);
    }
  }

  function handlePriceChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    setPriceText(raw);
    // Aceita "," (comum no Brasil) e "." como separador decimal.
    const parsed = Number(raw.replace(",", "."));
    if (raw.trim() !== "" && !Number.isNaN(parsed)) {
      setValues((current) => ({ ...current, priceCents: Math.max(0, Math.round(parsed * 100)) }));
    }
  }

  function handlePriceBlur() {
    // Só agora, ao sair do campo, normaliza de volta pra "0.00" — nunca
    // enquanto o usuário ainda está digitando (ver comentário no estado).
    setPriceText((values.priceCents / 100).toFixed(2));
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
    if (submittingRef.current) return;
    submittingRef.current = true;
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
        showSuccess("Produto salvo.");
      } else {
        const newId = await createProduct(tenantId, input);
        if (stagedCoverFile) {
          try {
            const { blob, width, height } = await compressImage(stagedCoverFile);
            const path = `tenants/${tenantId}/products/${newId}/cover.webp`;
            const { url, path: savedPath } = await uploadFile(path, blob, {
              contentType: "image/webp",
              access: "public",
            });
            await setProductCover(tenantId, newId, { url, path: savedPath, w: width, h: height });
          } catch {
            showError("Produto criado, mas não foi possível enviar a foto. Adicione depois na edição.");
          }
        }
        showSuccess("Produto criado.");
      }
      router.push(`/painel/${tenantSlug}/produtos`);
    } catch {
      setError("Não foi possível salvar. Confira os campos e tente de novo.");
      showError("Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  }

  async function handleDelete() {
    if (!values.id) return;
    setConfirmDeleteOpen(false);
    setSaving(true);
    try {
      await deleteProduct(tenantId, values.id);
      showSuccess("Produto apagado.");
      router.push(`/painel/${tenantSlug}/produtos`);
    } catch {
      showError("Não foi possível apagar o produto. Tente de novo.");
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
          <Button type="submit" loading={saving}>
            {isNew ? "Criar produto" : "Salvar e publicar"}
          </Button>
        </div>
      </div>

      {isNew && (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-heading text-lg font-semibold text-ink">Foto de capa</h2>
          <button
            type="button"
            onClick={() => stagedCoverInputRef.current?.click()}
            className="flex aspect-square w-full max-w-40 items-center justify-center overflow-hidden rounded-thumb border border-border bg-thumb-1"
          >
            {stagedCoverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview de upload local, não é conteúdo do cardápio
              <img src={stagedCoverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm text-muted">Enviar foto</span>
            )}
          </button>
          <input
            ref={stagedCoverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleStagedCoverFile}
          />
          {stagedCoverPreview && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => stagedCoverInputRef.current?.click()}>
                Trocar foto
              </Button>
              <Button type="button" variant="danger" onClick={handleRemoveStagedCover}>
                Remover
              </Button>
            </div>
          )}
          <p className="text-xs text-muted">Opcional — enviada junto quando o produto for criado.</p>
        </Card>
      )}

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
              type="text"
              inputMode="decimal"
              required
              value={priceText}
              onChange={handlePriceChange}
              onBlur={handlePriceBlur}
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
            onClick={() => setConfirmDeleteOpen(true)}
            className="self-start text-sm text-rec hover:underline"
          >
            Apagar produto
          </button>
        )}
      </Card>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Apagar produto?"
        description="Essa ação não pode ser desfeita."
        confirmLabel="Apagar"
        danger
        pending={saving}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </form>
  );
}
