"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

// ?origem=loja força o modo discreto do WhatsApp (origem presencial — ver
// docs/ARQUITETURA.md, "Origem da visita"); ?origem=instagram é reconhecido
// mesmo sem isso (User-Agent), mas o link explícito é mais confiável pra bio.
export function QrCodeGenerator({
  counterUrl,
  instagramUrl,
}: {
  counterUrl: string;
  instagramUrl: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(counterUrl, { width: 320, margin: 2 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [counterUrl]);

  async function handleCopy() {
    await navigator.clipboard.writeText(instagramUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface p-8">
        <p className="text-sm font-medium text-ink">QR do balcão</p>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL gerado no cliente, next/image não se aplica
          <img src={dataUrl} alt="QR code pro cardápio" width={240} height={240} />
        ) : (
          <div className="h-60 w-60 animate-pulse rounded-thumb bg-bg" />
        )}
        <p className="max-w-xs text-center text-xs text-muted">{counterUrl}</p>
        {dataUrl && (
          <a
            href={dataUrl}
            download="qrcode-cardapio.png"
            className="inline-flex min-h-11 items-center justify-center rounded-cta bg-accent px-5 text-sm font-medium text-surface hover:opacity-90"
          >
            Baixar PNG
          </a>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
        <p className="text-sm font-medium text-ink">Link da bio do Instagram</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={instagramUrl}
            className="min-h-11 flex-1 rounded-input border border-border bg-bg px-3 text-sm text-ink"
          />
          <Button type="button" variant="outline" onClick={handleCopy}>
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
