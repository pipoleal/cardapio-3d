# Modelo de dados (Firestore + Storage)

Inspirado no cardápio do BoaPedida (Categoria → Produto → GrupoOpcao → Opcao), simplificado para o piloto.

## Tipos comuns

```ts
type Locale = "pt" | "en" | "es";
type LocalizedText = { pt: string; en?: string; es?: string };
type Allergen =
  | "gluten" | "lactose" | "milk" | "egg" | "peanut" | "tree_nuts"
  | "soy" | "sesame" | "fish" | "shellfish" | "sulfites";
// Aprovação de tradução por ENTIDADE (tenant, categoria, produto), não por
// campo: um único i18nStatus[locale] === "approved" libera TODOS os
// LocalizedText daquela entidade pro cliente de uma vez (ver "Traduções" no
// fim deste arquivo).
type I18nStatus = { en?: "missing" | "auto" | "approved"; es?: "missing" | "auto" | "approved" };
```

## Coleções

### `slugs/{slug}`
Reserva única de subdomínio.
```ts
{ tenantId: string; createdAt: Timestamp }
```

### `users/{uid}`
```ts
{ email: string; displayName?: string; tenantIds: string[]; createdAt: Timestamp }
// superadmin = custom claim no Auth, não campo aqui.
// tenantIds guarda o tenantId de cada loja — que neste app é sempre igual
// ao slug (ver scripts/seed.ts), então dá pra usar direto em getTenantBySlug.
// Schema zod em src/lib/schemas/user.ts; lido por src/lib/user.ts (sem
// 'use cache' — decide acesso, precisa estar sempre fresco).
```

### `tenants/{tenantId}`
```ts
{
  slug: string;                 // subdomínio
  name: string;
  description?: LocalizedText;
  logoUrl?: string; logoPath?: string; coverUrl?: string;
  whatsapp: string;             // E.164 sem "+", ex.: "5511999999999"
  whatsappTemplate?: LocalizedText; // "Olá! Quero encomendar {produto} ({variacao})"
  whatsappMode: "discreet" | "prominent" | "off"; // padrão "discreet". "prominent" = CTA fixo chamativo; "discreet" = sem CTA fixo, só dicas discretas; "off" = nenhum WhatsApp em lugar nenhum. Só vale pra origem instagram/direto — origem presencial sempre reduz "prominent" pra "discreet" ("off" continua "off", ver lib/origin.ts)
  instagram?: string; address?: string; openingHours?: LocalizedText;
  i18nStatus?: I18nStatus;      // libera description + openingHours + whatsappTemplate juntos
  locales: Locale[];            // ex.: ["pt","en","es"]
  defaultLocale: Locale;        // "pt"
  theme: { primary: string; background?: string; font?: "sans" | "serif" };
  ownerUids: string[];
  plan: "pilot" | "free" | "pro";
  limits: { modelsPerMonth: number; products: number };
  active: boolean;
  createdAt: Timestamp; updatedAt: Timestamp;
}
```

### `tenants/{tenantId}/categories/{categoryId}`
```ts
{ name: LocalizedText; i18nStatus?: I18nStatus; order: number; active: boolean }
```

### `tenants/{tenantId}/products/{productId}`
```ts
{
  categoryId: string;
  name: LocalizedText;
  description?: LocalizedText;
  priceCents: number;               // preço base
  variants?: {                      // ex.: tamanhos do bolo (P/M/G), caixa com 6/12/25 brigadeiros
    id: string; name: LocalizedText; priceCents: number;
  }[];
  servings?: number;                // "serve N pessoas"
  allergens: Allergen[];
  mayContain?: Allergen[];          // "pode conter traços de"
  tags?: ("vegan" | "sugar_free" | "gluten_free" | "new" | "bestseller")[];
  coverImage?: { url: string; path: string; w: number; h: number };
  model: {
    status: "none" | "processing" | "ready" | "failed";
    glbUrl?: string; glbPath?: string;
    usdzUrl?: string; usdzPath?: string;
    posterUrl?: string;
    jobId?: string;
    scale?: number;                 // ajuste de tamanho real no AR (metros)
    route?: "photos_ai" | "video_scan" | "upload"; // "upload" = "Subir meu modelo" (manual, sem job)
    costCents?: number;             // custo da geração (mostrado no painel)
    fileSizeBytes?: number;
    updatedAt?: Timestamp;
  };
  sliceModel?: Product["model"];    // opcional: modelo da fatia (alternador Inteiro | Fatia)
  i18nStatus?: I18nStatus;          // libera name + description + variants[].name juntos
  available: boolean;               // false = "esgotado hoje"
  freshFromOvenAt?: Timestamp | null; // "saiu do forno" — aparece por FRESH_HOURS (padrão 3 h)
  acceptsOrders: boolean;           // "aceita encomenda" (mostra ou esconde o botão do WhatsApp)
  order: number;
  createdAt: Timestamp; updatedAt: Timestamp;
}
```

### `tenants/{tenantId}/modelJobs/{jobId}` (só o servidor escreve)
```ts
{
  productId: string;
  provider: "meshy" | "fake";       // "fake" = provider de dev, sem custo (lib/three-d/fake.ts)
  providerTaskId: string;
  mode: "single" | "multi";         // 1 foto ou várias (até 4)
  inputPaths: string[];             // Storage
  status: "queued" | "processing" | "succeeded" | "failed" | "canceled";
  progress: number;                 // 0–100
  target: "model" | "sliceModel";
  costCents?: number;
  error?: string;
  createdBy: string;                // uid
  createdAt: Timestamp; finishedAt?: Timestamp;
  finalizing?: boolean;             // trava de transação — só quem vira false→true copia pro Storage (docs/PIPELINE-3D.md, "Idempotência")
}
```

### `tenants/{tenantId}/stats/{AAAA-MM-DD}` (só o servidor escreve)
```ts
{
  menu_view: number;
  product_view: Record<string, number>;
  model_open: Record<string, number>;
  ar_open: Record<string, number>;
  whatsapp_click: Record<string, number>;
  locale: Record<Locale, number>;
  origin: Record<string, number>;   // contagem de visitas por origem (Etapa 5) — chaves livres: "loja", "mesa", "vitrine", "instagram", "direto" etc., ver lib/origin.ts
}
```

## Índices
- `products`: `categoryId ASC, order ASC`; `available ASC, order ASC`.
- `modelJobs`: `status ASC, createdAt DESC`.

> **Traduções:** o cardápio público mostra en/es só quando `i18nStatus[locale] === "approved"`; senão cai para `pt`.
> `i18nStatus` existe em três lugares — `tenants/{tenantId}`, `tenants/{tenantId}/categories/{categoryId}` e
> `tenants/{tenantId}/products/{productId}` — e é sempre **por entidade, não por campo**: aprovar o `en` de
> um produto libera nome, descrição e nome das variações juntos; aprovar o `en` do tenant libera descrição,
> horário de funcionamento e template do WhatsApp juntos. Não existe aprovação parcial (ex.: nome aprovado
> mas descrição não) — simplifica o "Aprovar tradução" do mockup 05 (Etapa 3) pra um botão só por entidade.

## Storage (`StorageProvider`, `lib/storage/` — Firebase em dev, Vercel Blob em produção/staging)

```
tenants/{tenantId}/branding/logo.webp
tenants/{tenantId}/products/{productId}/cover.webp
tenants/{tenantId}/products/{productId}/captures/{captureId}/{pose}.webp   # captureId: gerado no cliente (crypto.randomUUID()), não é o jobId
tenants/{tenantId}/products/{productId}/models/model.{glb|gltf}
tenants/{tenantId}/products/{productId}/models/model.usdz
tenants/{tenantId}/products/{productId}/models/poster.{ext}
```

Público (leitura de qualquer um): `branding/`, `cover.webp`, `models/`. Privado (só o dono e o
servidor): `captures/` — nunca públicas, nem no Vercel Blob (store separado, ver
`docs/DEPLOY-STAGING.md`).

No provider Firebase esses caminhos são fixos (reenviar sobrescreve no mesmo lugar). No provider
Vercel Blob, cada upload ganha um sufixo aleatório (`addRandomSuffix: true`) — o caminho salvo no
Firestore (`coverImage.path`, `logoPath`, `model.glbPath`/`usdzPath`) é sempre o que o storage
devolveu de verdade, nunca reconstruído a partir do padrão acima; o arquivo anterior é apagado
depois de salvar o novo (capa/logo/modelo — fotos de captura ficam, limpeza futura, ver ROADMAP).
`models/` usa nome fixo (não por jobId) — cada geração nova sobrescreve a anterior, mesmo raciocínio de `cover.webp`.
