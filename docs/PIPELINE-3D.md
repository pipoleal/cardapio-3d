# Pipeline 3D — captura no site → modelo GLB/USDZ

Decisão do piloto: **IA foto → 3D (Meshy)**, atrás de uma interface para poder trocar de provedor (Tripo, fotogrametria etc.).

> ⚠️ Antes de implementar, confira a documentação atual da Meshy (https://docs.meshy.ai): endpoints, parâmetros, formatos de saída e preços mudam. Os nomes abaixo são a referência de design, não um contrato.

## 1. Captura no navegador (`components/capture/`)

Assistente em 3 passos, pensado para o celular do lojista:

1. **Preparar:** dicas visuais — fundo liso e contrastante, luz difusa (perto de janela, sem sol direto), produto inteiro no quadro, sem mãos, prato neutro.
2. **Fotografar:** até **4 fotos** (frente, 45°, lateral e de cima) com overlay de guia.
   - `<input type="file" accept="image/*" capture="environment">` (funciona em qualquer celular) **ou** câmera ao vivo com `getUserMedia` + overlay (melhor UX; usar se suportado).
   - Checagem simples no cliente: resolução mínima de 1024px e aviso de foto escura/borrada (variância do Laplaciano em um canvas pequeno).
3. **Revisar e enviar:** miniaturas, refazer foto, "Gerar 3D".

Compressão no cliente (≈ 2048px, WebP 0,85, `lib/image-compress.ts`) → upload para
`tenants/{tenantId}/products/{productId}/captures/{captureId}/{pose}.webp` com o SDK web do
Storage (`captureId` é gerado no cliente, `crypto.randomUUID()` — não é o `jobId`, que só existe
depois que o servidor cria o `modelJobs/{jobId}`).

## 2. Servidor

```
POST /api/models            { tenantId, productId, inputPaths[] }
  → verifica token + dono + limite mensal
  → gera URLs assinadas (leitura, 1 h) das fotos
  → provider.createTask(urls)  → providerTaskId
  → cria modelJobs/{jobId} (status: processing); product.model.status = "processing"
  → 202 { jobId }

GET  /api/models/{jobId}?tenantSlug=
  → se o job já terminou: devolve o doc
  → senão: provider.getTask(providerTaskId)
      · SUCCEEDED → baixa GLB, USDZ e thumbnail → envia ao nosso Storage
                    → product.model = { status: "ready", glbUrl, usdzUrl, posterUrl, ... }
      · FAILED    → job.failed; product.model.status = "failed"
  → 200 { status, progress }
```

- O painel faz **polling a cada 5 s** (com backoff até 30 s) enquanto houver job em `processing` — não só na tela do produto: o `ModelJobsPoller` monta no layout do painel (`painel/[tenantSlug]/layout.tsx`) e sonda todo job ativo da loja em qualquer página, então o pipeline avança mesmo que a dona tenha saído da tela do produto. O card do produto (`Model3DStatus.tsx`) também escuta o doc via `onSnapshot` pra atualizar na hora, sem esperar o próprio poll.
- **Idempotência:** o `GET` usa uma transação para que só uma requisição faça a cópia para o Storage (flag `job.finalizing`).
- **Job "travado":** um job em `processing` há mais de 24h é marcado `failed` automaticamente na próxima sondagem (evita ficar preso pra sempre se a Meshy nunca responder).
- **Webhook (implementado, opcional):** `POST /api/models/webhook/[provider]` finaliza um job assim
  que o provedor termina, sem depender do painel estar aberto (a Meshy chama a gente, não o
  contrário) — a mesma lógica de finalização de `lib/three-d/jobs.ts` (`applyModelTaskResult`),
  compartilhada com o polling. A Meshy configura o webhook por conta inteira no dashboard (URL
  HTTPS, máx. 5/conta, não por request) e **não assina a requisição** (confirmado na doc) — a
  autenticação é um segredo na própria URL (`?token=`, `MESHY_WEBHOOK_SECRET`). Genérico por
  `[provider]` de propósito: serve pro futuro worker 3D próprio também. Configurar isso é um passo
  manual de deploy (`docs/DEPLOY-STAGING.md`) — o polling continua funcionando de qualquer jeito,
  então o pipeline nunca fica travado só porque o webhook não foi configurado ainda.
- **Tempo limite da Vercel:** o download e o upload de ~20 MB cabem no limite padrão; se passar disso, fazer streaming (`fetch` → `file.createWriteStream`).

## 3. Interface de provedor (`lib/three-d/provider.ts`)

```ts
export interface ModelProvider {
  name: "meshy" | "fake";
  createTask(input: { imageUrls: string[] }): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<{
    status: "queued" | "processing" | "succeeded" | "failed";
    progress: number;
    outputs?: { glbUrl: string; usdzUrl?: string; thumbnailUrl?: string };
    error?: string;
    consumedCredits?: number;
  }>;
}
```

**Meshy** (confirmado na documentação, docs.meshy.ai): só o endpoint *Multi-Image to 3D*
(`POST /openapi/v1/multi-image-to-3d`, `GET .../{id}`) — aceita de 1 a 4 fotos, então não precisa
alternar com o endpoint de imagem única. `image_urls` aceita tanto URL pública quanto data URI
base64; como a Meshy não alcança URLs do emulador local, `lib/three-d/input-images.ts` manda
base64 quando `NEXT_PUBLIC_USE_EMULATORS=true` e URL assinada (1h) em produção. Pede textura,
saída GLB + USDZ, e um número de polígonos moderado (o foco é abrir leve no celular). Custo: 20
créditos por task por padrão (mais se pedir PBR/resolução maior) — `MESHY_CREDIT_PRICE_CENTS`
converte `consumed_credits` em `product.model.costCents`.

**Provider `fake`** (`lib/three-d/fake.ts`, padrão em dev): sem rede, sem custo, sem estado em
memória — o horário de criação vai codificado no próprio `taskId` (`fake-<timestamp>`), então
sobrevive a um reload do servidor de dev. Devolve como output o `.gltf` de amostra em
`public/sample-models/` (gerado por `scripts/generate-sample-model.ts`), que passa pelo **mesmo**
caminho de cópia pro Storage que a Meshy de verdade (`finalizeModelOutputs`) — sem atalho. Não
tem USDZ de verdade — mas isso não impede o AR no iPhone: o `<model-viewer>` já gera um USDZ
automaticamente no navegador a partir do `.gltf`/`.glb` quando `ios-src` está ausente (ver
`docs/DECISOES.md` #25); o Safari real é que precisa validar isso (não dá pra automatizar fora de
hardware Apple), então continua valendo rodar uma vez com `MODEL_PROVIDER=meshy` e um iPhone de
verdade pra conferir o fluxo completo.

## 4. Pós-processamento (fase 2)

- Compressão do GLB com `gltf-transform` (Draco/Meshopt + texturas WebP/KTX2) para ficar com menos de 5 MB.
- ~~Se o provedor não devolver USDZ: gerar com a exportação USDZ do `<model-viewer>`/three.js~~ — já
  acontece sozinho, o `<model-viewer>` faz isso no navegador do visitante sem precisar de nada do
  nosso servidor (ver `docs/DECISOES.md` #25). O que falta é só validar em iPhone real com modelos
  variados (materiais incomuns podem falhar na conversão automática — ver ressalva na decisão).
- Editor simples no painel: girar e centralizar o modelo, ajustar a escala real (ex.: brigadeiro ≈ 3 cm) → `product.model.scale`.

## 5. Visualização (`components/viewer/ProductViewer.tsx`)

```html
<model-viewer
  src="{glbUrl}" ios-src="{usdzUrl}" poster="{posterUrl}"
  alt="{nome do produto}"
  camera-controls touch-action="pan-y" auto-rotate
  ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed"
  shadow-intensity="1" environment-image="neutral" loading="lazy">
  <button slot="ar-button">Ver na minha mesa</button>
</model-viewer>
```

Eventos para o analytics: `load` → `model_open`; `ar-status === "session-started"` → `ar_open`.

O botão "Ver na sua mesa" da página pública fica **fora** do `ProductViewer` (como no mockup, não
o `slot="ar-button"` interno) — `ArButton.tsx` aciona `activateAR()` pelo id estável
`product-model-viewer` do elemento. `<model-viewer>` é carregado só no cliente via
`dynamic(..., { ssr: false })` (regra 9 do CLAUDE.md); como isso só é permitido dentro de um
Client Component, existe um arquivo `ProductViewerLazy.tsx` só pra esse `dynamic()`.

## 6. Qualidade esperada / riscos

- IA foto→3D funciona bem com formas simples (bolo, torta, croissant, brigadeiro). Brilho (calda, ganache) e transparência podem sair piores — testar no piloto e ajustar as dicas de captura.
- Sempre guardar as fotos originais: dá para gerar de novo com um provedor melhor no futuro.
- Se a IA não ficar fiel o bastante, o plano B é fotogrametria (vídeo 360°) com outro `ModelProvider`.
