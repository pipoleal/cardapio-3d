"use client";

import { ref as storageRef, uploadBytes } from "firebase/storage";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";
import { storage } from "@/lib/firebase/client";
import { compressImage } from "@/lib/image-compress";
import { checkPhotoQuality, type PhotoQuality } from "@/lib/photo-quality";

type Pose = { id: string; label: string; hint: string };

// 4 poses (docs/PIPELINE-3D.md) — frente, 45°, lateral e de cima.
const POSES: Pose[] = [
  { id: "frente", label: "Frente", hint: "De frente, produto inteiro no centro do quadro." },
  { id: "45", label: "45°", hint: "Gire o produto (ou ande ao redor) até uns 45°." },
  { id: "lateral", label: "Lateral", hint: "De lado, mostrando o perfil do produto." },
  { id: "cima", label: "De cima", hint: "Direto de cima, olhando pra baixo." },
];

const PREPARE_TIPS = [
  "Fundo liso e contrastante (evite estampas)",
  "Luz difusa — perto de uma janela, sem sol direto",
  "Produto inteiro dentro do quadro, sem mãos ou talheres",
  "Prato ou superfície neutra, sem logotipos",
];

type CapturedPhoto = { blob: Blob; previewUrl: string; quality: PhotoQuality };
type Phase = "prepare" | "capture" | "review";

function hasSecureCamera(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
}

// Assistente de captura guiada (mockup 03). Só a rota "Fotos · IA" é
// funcional — "Vídeo · escaneamento" fica com o selo "em breve", inerte
// (fotogrametria por vídeo é plano B, ver docs/PIPELINE-3D.md §6).
export function CaptureFlow({
  tenantId,
  tenantSlug,
  productId,
  productName,
}: {
  tenantId: string;
  tenantSlug: string;
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"video" | "photos">("photos");
  const [phase, setPhase] = useState<Phase>("prepare");
  const [poseIndex, setPoseIndex] = useState(0);
  const [photos, setPhotos] = useState<Record<string, CapturedPhoto>>({});
  // Inicializa já sabendo se dá pra tentar câmera ao vivo (contexto seguro
  // + getUserMedia) — evita setState síncrono no corpo do efeito abaixo.
  const [cameraFailed, setCameraFailed] = useState(() => !hasSecureCamera());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pose = POSES[poseIndex]!;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Câmera ao vivo só quando disponível (contexto seguro — ver README,
  // "Rodando no celular"); no HTTP simples, ou se getUserMedia falhar,
  // cai pro <input capture="environment"> (funciona em qualquer celular).
  useEffect(() => {
    if (phase !== "capture" || activeTab !== "photos" || cameraFailed) {
      stopCamera();
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) setCameraFailed(true);
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [phase, activeTab, cameraFailed, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const storePhoto = useCallback(
    async (blob: Blob) => {
      const quality = await checkPhotoQuality(blob);
      setPhotos((prev) => {
        const old = prev[pose.id];
        if (old) URL.revokeObjectURL(old.previewUrl);
        return { ...prev, [pose.id]: { blob, previewUrl: URL.createObjectURL(blob), quality } };
      });
      setPoseIndex((index) => {
        if (index < POSES.length - 1) return index + 1;
        setPhase("review");
        return index;
      });
    },
    [pose.id],
  );

  function handleShutter() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) void storePhoto(blob);
    }, "image/webp", 0.9);
  }

  function handleFileFallback(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void storePhoto(file);
  }

  function handleRetake(index: number) {
    setPoseIndex(index);
    setCameraFailed(!hasSecureCamera());
    setPhase("capture");
  }

  function handleClose() {
    Object.values(photos).forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    router.push(`/painel/${tenantSlug}/produtos/${productId}`);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const captureId = crypto.randomUUID();
      const inputPaths: string[] = [];
      for (const p of POSES) {
        const photo = photos[p.id];
        if (!photo) continue;
        const { blob } = await compressImage(photo.blob);
        const path = `tenants/${tenantId}/products/${productId}/captures/${captureId}/${p.id}.webp`;
        await uploadBytes(storageRef(storage, path), blob, { contentType: "image/webp" });
        inputPaths.push(path);
      }

      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, productId, inputPaths }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? "Não foi possível iniciar a geração 3D.");
      }

      Object.values(photos).forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      router.push(`/painel/${tenantSlug}/produtos/${productId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar as fotos.");
      setSubmitting(false);
    }
  }

  const allCaptured = POSES.every((p) => photos[p.id]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-capture-bg text-capture-highlight">
      <header className="flex items-center justify-between px-4 py-4">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar captura"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <CloseIcon />
        </button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-capture-highlight/60">Captura guiada</p>
          <p className="font-heading text-base font-semibold">{productName}</p>
        </div>
        <div className="min-w-11" />
      </header>

      <div className="mx-4 flex rounded-full bg-capture-surface p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("video")}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full transition-colors",
            activeTab === "video" ? "bg-white text-ink" : "text-capture-highlight/70",
          )}
        >
          Vídeo · escaneamento
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase">
            Em breve
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("photos")}
          className={cn(
            "min-h-11 flex-1 rounded-full transition-colors",
            activeTab === "photos" ? "bg-white text-ink" : "text-capture-highlight/70",
          )}
        >
          Fotos · IA
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {activeTab === "video" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="font-heading text-lg font-semibold">Escaneamento por vídeo chega em breve</p>
            <p className="max-w-xs text-sm text-capture-highlight/70">
              Por enquanto, use &ldquo;Fotos · IA&rdquo; — 4 fotos já geram um modelo 3D completo.
            </p>
          </div>
        ) : phase === "prepare" ? (
          <div className="flex flex-1 flex-col justify-center gap-6">
            <div className="flex flex-col gap-3 rounded-card bg-capture-surface p-5">
              <p className="font-heading text-lg font-semibold">Antes de começar</p>
              <ul className="flex flex-col gap-2 text-sm text-capture-highlight/80">
                {PREPARE_TIPS.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span aria-hidden="true">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setPhase("capture")}
              className="min-h-11 rounded-input bg-accent px-4 py-3 text-sm font-semibold text-surface"
            >
              Começar
            </button>
          </div>
        ) : phase === "capture" ? (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex gap-1.5">
              {POSES.map((p, index) => (
                <div
                  key={p.id}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    photos[p.id] ? "bg-accent-soft" : index === poseIndex ? "bg-white" : "bg-white/20",
                  )}
                />
              ))}
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-card bg-capture-surface">
              {!cameraFailed ? (
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <p className="text-sm text-capture-highlight/80">
                    Câmera ao vivo indisponível aqui — use o botão abaixo pra tirar a foto com a câmera do
                    celular.
                  </p>
                </div>
              )}

              <div className="pointer-events-none absolute inset-8 rounded-full border-2 border-dashed border-white/50" />
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-center">
                <p className="text-sm font-semibold">
                  {poseIndex + 1} · {pose.label}
                </p>
              </div>
            </div>

            <p className="text-center text-sm text-capture-highlight/70">{pose.hint}</p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileFallback}
            />
            <div className="flex justify-center pb-2">
              {!cameraFailed ? (
                <button
                  type="button"
                  onClick={handleShutter}
                  aria-label="Capturar foto"
                  className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white"
                >
                  <span className="h-12 w-12 rounded-full bg-rec" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-11 rounded-input bg-accent px-5 py-3 text-sm font-semibold text-surface"
                >
                  Tirar foto
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            <p className="font-heading text-lg font-semibold">Revisar fotos</p>
            <div className="grid grid-cols-2 gap-3">
              {POSES.map((p, index) => {
                const photo = photos[p.id];
                const warnings = photo
                  ? [
                      !photo.quality.minResolutionOk && "Resolução baixa",
                      photo.quality.blurry && "Pode estar borrada",
                      photo.quality.dark && "Iluminação fraca",
                    ].filter(Boolean)
                  : [];
                return (
                  <div key={p.id} className="flex flex-col gap-2 rounded-card bg-capture-surface p-2">
                    <div className="aspect-square overflow-hidden rounded-thumb bg-black/30">
                      {photo && (
                        // eslint-disable-next-line @next/next/no-img-element -- preview local (Blob URL), nunca é conteúdo do cardápio
                        <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <p className="text-xs font-medium">{p.label}</p>
                    {warnings.length > 0 && (
                      <p className="text-[11px] text-warning">{warnings.join(" · ")}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRetake(index)}
                      className="min-h-9 rounded-input border border-white/20 text-xs font-medium hover:bg-white/10"
                    >
                      Refazer
                    </button>
                  </div>
                );
              })}
            </div>

            {error && <p className="text-sm text-rec">{error}</p>}

            <button
              type="button"
              disabled={!allCaptured || submitting}
              onClick={() => void handleSubmit()}
              className="min-h-11 rounded-input bg-accent px-4 py-3 text-sm font-semibold text-surface disabled:opacity-50"
            >
              {submitting ? "Enviando..." : "Gerar 3D"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
