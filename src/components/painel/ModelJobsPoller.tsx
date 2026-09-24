"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type ActiveJob = { jobId: string; productId: string };

const MIN_DELAY_MS = 5000;
const MAX_DELAY_MS = 30000;

/**
 * Monta em TODA página do painel (via layout) — retoma a sondagem de jobs
 * "processing"/"queued" mesmo que a dona tenha saído da tela do produto
 * específico (foi pra "Produtos", "Visão geral" etc.). Sem UI própria —
 * só chama `router.refresh()` quando algum job termina, pra a página
 * atual (seja qual for) pegar o dado novo.
 */
export function ModelJobsPoller({ tenantSlug, jobs }: { tenantSlug: string; jobs: ActiveJob[] }) {
  const router = useRouter();
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    async function poll(jobId: string, delay: number) {
      if (stoppedRef.current) return;
      try {
        const response = await fetch(`/api/models/${jobId}?tenantSlug=${tenantSlug}`);
        const data = (await response.json()) as { status?: string };
        if (data.status === "succeeded" || data.status === "failed") {
          router.refresh();
          return;
        }
      } catch {
        // rede falhou — tenta de novo no próximo ciclo, sem travar os outros jobs
      }
      if (stoppedRef.current) return;
      const nextDelay = Math.min(delay * 1.5, MAX_DELAY_MS);
      timers.push(setTimeout(() => poll(jobId, nextDelay), nextDelay));
    }

    for (const job of jobs) {
      timers.push(setTimeout(() => poll(job.jobId, MIN_DELAY_MS), MIN_DELAY_MS));
    }

    return () => {
      stoppedRef.current = true;
      timers.forEach(clearTimeout);
    };
  }, [tenantSlug, jobs, router]);

  return null;
}
