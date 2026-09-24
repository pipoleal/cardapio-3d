# Arquitetura — Cardápio 3D

## Visão geral

```
                    ┌──────────────────────── Vercel (Next.js) ────────────────────────┐
 cliente final ───▶ │ proxy.ts (host → tenant)                                          │
 (celular)          │   ├─ <DOMINIO>            → (site) landing / cadastro             │
                    │   ├─ <slug>.<DOMINIO>     → /loja/[tenant]/[locale]  (RSC)        │
 lojista ─────────▶ │   ├─ <slug>.<DOMINIO>/painel → painel (client + regras)           │
                    │   └─ /api/*  Route Handlers (Admin SDK, chave Meshy)              │
                    └───────┬──────────────────────────────┬───────────────────────────┘
                            │                              │
                   Firebase │ Auth · Firestore · Storage   │ HTTPS
                            ▼                              ▼
                      dados + arquivos               Meshy API (foto → GLB/USDZ)
```

## Fluxos principais

### 1. Cliente final vê o cardápio
1. Abre `boaconfe.<DOMINIO>` (QR code no balcão/Instagram).
2. `proxy.ts` detecta o idioma (cookie → `Accept-Language` → `pt`) e reescreve para `/loja/boaconfe/pt`.
3. A página (Server Component) busca `tenants/{id}` + categorias + produtos disponíveis, com cache de 60 s.
4. Produto → página com `<model-viewer>`: girar/zoom, botão **"Ver na minha mesa"** (AR):
   - Android: Scene Viewer / WebXR com o GLB.
   - iPhone: AR Quick Look com o USDZ (`ios-src`).
5. Botão **"Encomendar pelo WhatsApp"** → `https://wa.me/<numero>?text=<mensagem>` com o nome do produto, a variação e o link.
6. Cada ação dispara `POST /api/track` (ver Analytics).

### 2. Lojista cadastra a loja
1. Em `<DOMINIO>/cadastro`: login (Google ou e-mail), nome da loja, **subdomínio desejado**, WhatsApp.
2. `POST /api/tenants` valida o slug (regex `^[a-z0-9](-?[a-z0-9]){2,30}$`, lista de reservados) e faz uma **transação**: cria `slugs/{slug}` (garante unicidade) + `tenants/{id}` + `users/{uid}`.
3. Redireciona para `<slug>.<DOMINIO>/painel`.

### 3. Lojista cadastra um produto com 3D
1. Painel → Produtos → Novo: nome (pt obrigatório, en/es opcionais), descrição, preço, categoria, alergênicos, variações, foto de capa.
2. Aba **Capturar 3D** → assistente de captura (ver `PIPELINE-3D.md`).
3. O status do modelo aparece no card do produto: `processando` → `pronto` (ou `falhou`, com botão para tentar de novo).

### 4. Superadmin (Felipe)
- `/admin` no domínio raiz, só para quem tem a custom claim `role=superadmin`.
- Lista lojas, entra no painel de qualquer loja e faz a captura 3D como serviço.

## Multi-tenant

- **Resolução:** `proxy.ts` extrai o subdomínio de `host` comparando com `NEXT_PUBLIC_ROOT_DOMAIN`. Em dev, `demo.localhost:3000`. O proxy tenta resolver **qualquer** subdomínio como tenant (inclusive `demo`, a loja de exemplo criada pelo seed) — a lista de subdomínios reservados do `CLAUDE.md` só é usada para recusar slugs no cadastro (`POST /api/tenants`), não para bloquear roteamento.
- **Isolamento:** dados em `tenants/{tenantId}/...`; regras do Firestore conferem se `request.auth.uid` está em `tenant.ownerUids` ou se é superadmin.
- **DNS/Vercel:** domínio raiz + `*.<DOMINIO>` no projeto Vercel. Domínio curinga na Vercel exige usar os nameservers da Vercel.
- **Futuro:** domínio próprio da loja (`cardapio.confeitaria.com.br`) → mapear `customDomains/{host}` → tenantId.

## Internacionalização

- `next-intl` com locales `pt` (padrão), `en`, `es`; o prefixo de idioma fica na URL interna (`/loja/[tenant]/[locale]`), e para o cliente aparece como `boaconfe.<DOMINIO>/en`.
- **Textos da interface:** `src/messages/*.json`.
- **Conteúdo da loja:** campos `LocalizedText = { pt: string; en?: string; es?: string }`.
- A loja escolhe quais idiomas mostrar (`tenant.locales`). Seletor de idioma no topo do cardápio.
- **Tradução automática com aprovação (já no piloto, como no mockup 05):** `POST /api/translate` (servidor) preenche en/es e marca `i18nStatus = "auto"`; o lojista revisa e clica em "Aprovar tradução" (`"approved"`). O cliente só vê traduções aprovadas. Provedor sugerido: Google Cloud Translation (tem cota grátis mensal; confira os limites atuais) atrás de uma interface `Translator`.

## Origem da visita e modo do WhatsApp

Pra saber se o cliente já está na loja (e por isso pode simplesmente pedir no balcão) ou está vendo o cardápio de longe (Instagram, link direto), o `proxy.ts` resolve uma **origem** por request (`src/lib/origin.ts`):

1. `?origem=<slug>` na URL (QR code do balcão → `loja`, bio do Instagram → `instagram`, e qualquer outro slug livre: `mesa`, `vitrine`...). Se presente e válido, vira cookie de sessão `c3d_origin` e a URL é redirecionada pra ela mesma **sem** o parâmetro (limpa, pra não propagar quando o cliente compartilha o link) — só numa navegação de documento de verdade (`Sec-Fetch-Dest: document`), igual ao cookie de locale.
2. Sem `?origem=` na URL: usa o cookie `c3d_origin`, se existir.
3. Sem cookie: heurística pelo User-Agent — navegador interno do Instagram → `instagram`; senão → `direto`.

O proxy expõe o resultado pras páginas via header `x-origin` (recalculado a cada request, nunca confia num `x-origin` vindo do cliente — mesmo padrão do `x-tenant`).

**Regra de exibição do CTA do WhatsApp:** origens presenciais (`loja`, `mesa`, `vitrine` — lista configurável em `PRESENCIAL_ORIGINS`) sempre escondem o botão fixo do WhatsApp, não importa a configuração da loja. Pra `instagram`/`direto`, vale `tenant.whatsappMode` (`"discreet"` esconde, `"direct"` mostra).

**Etapa 3 (painel):** a tela de QR Code deve gerar um QR com `?origem=loja` e mostrar o link da bio do Instagram com `?origem=instagram` (botão de copiar).

## Analytics (custo zero)

- **Eventos próprios** via `POST /api/track` → incremento em `tenants/{id}/stats/{AAAA-MM-DD}` usando `FieldValue.increment` (um documento por dia, com campos agregados):
  `menu_view`, `product_view.{productId}`, `model_open.{productId}`, `ar_open.{productId}`, `whatsapp_click.{productId}`, `locale.{pt|en|es}`, `origin.{loja|mesa|vitrine|instagram|direto|...}` (Etapa 5 — contagem de visitas por origem, ver seção acima).
- Não gravar dado pessoal (LGPD). Sem cookies de rastreamento: o banner de cookies não é necessário para isso.
- Proteção básica: rate limit por IP em memória + `sendBeacon`; ignorar bots pelo user-agent.
- **Painel → Estatísticas:** gráfico dos últimos 30 dias + top produtos + taxa "abriu o 3D → clicou no WhatsApp".
- **Vercel Web Analytics** (grátis no Hobby) para visão geral de visitas no site do produto.

## Segurança

- Regras do Firestore/Storage em `firebase/` (versionadas, testadas no emulador).
- Custom claim `role: "superadmin"` definida por script (`scripts/set-superadmin.ts`).
- Route Handlers verificam o ID token (`Authorization: Bearer <idToken>`) com o Admin SDK e checam a posse do tenant.
- Upload: só imagens (`image/jpeg|png|webp`), ≤ 8 MB cada, com compressão no cliente antes de enviar (≈ 2048px, qualidade 0,85).
- GLB ≤ 15 MB; USDZ ≤ 20 MB.

## Performance

- Lista do cardápio **sem** 3D (só foto/poster); o viewer carrega só na página do produto.
- `next/image` para fotos; `poster` do model-viewer = imagem de capa.
- Meta: LCP < 2,5 s em 4G no cardápio.

## Custos a ficar de olho

- **Firebase Storage** exige o plano **Blaze** (pago conforme o uso, com cota grátis) para buckets novos desde out/2024. Configure **alerta de orçamento** no Google Cloud logo no início.
- **Meshy:** cobra créditos por modelo gerado. Limite de gerações por loja/mês (`tenant.limits.modelsPerMonth`).
- **Vercel Hobby** é para uso não comercial; quando houver loja pagante, migrar para o Pro (ou avaliar o Firebase App Hosting).
