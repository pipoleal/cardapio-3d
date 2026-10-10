"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { setProductFresh } from "@/lib/actions/products";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function MarkFreshForm({
  tenantId,
  products,
}: {
  tenantId: string;
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productId) return;
    setLoading(true);
    try {
      await setProductFresh(tenantId, productId, true);
      router.refresh();
      showSuccess("Marcado como 'saiu do forno'.");
    } catch {
      showError("Não foi possível marcar 'saiu do forno'.");
    } finally {
      setLoading(false);
    }
  }

  if (products.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <select
        aria-label="Produto"
        value={productId}
        onChange={(event) => setProductId(event.target.value)}
        className="min-h-11 rounded-input border border-border bg-surface px-3 text-sm text-ink"
      >
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
      <Button type="submit" loading={loading}>
        Marcar &quot;saiu do forno&quot;
      </Button>
    </form>
  );
}
