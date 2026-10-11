"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { translateAllMissing } from "@/lib/actions/translate";

/** Traduz de uma vez só as categorias/produtos "missing" (nunca traduzidos) — pula qualquer item já "auto" ou "approved", nunca sobrescreve. */
export function TranslateAllButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const { translated, failed } = await translateAllMissing(tenantId);
      router.refresh();
      if (translated === 0 && failed === 0) {
        showSuccess("Nada pra traduzir — tudo já tem alguma tradução.");
      } else if (failed === 0) {
        showSuccess(`${translated} ${translated === 1 ? "item traduzido" : "itens traduzidos"}.`);
      } else {
        showError(`${translated} traduzidos, ${failed} falharam. Tente de novo em instantes.`);
      }
    } catch {
      showError("Não foi possível traduzir. Tente de novo em instantes.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" loading={pending} onClick={handleClick}>
      Traduzir tudo
    </Button>
  );
}
