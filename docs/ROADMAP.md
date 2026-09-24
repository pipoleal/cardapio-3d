# Roadmap de implementação

O Claude Code segue em ordem, marca `[x]` ao concluir e roda `lint` + `typecheck` + `build` ao fim de cada etapa.

## Etapa 0 — Setup
- [x] Criar o app Next.js em uma pasta temporária e **mover para a raiz** (o create-next-app recusa pasta com arquivos):
      `npx create-next-app@latest tmp_scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*"` (nome não pode começar com `_`, por restrição do npm) → mover o conteúdo de `tmp_scaffold/` para a raiz, mesclando `src/` e `.gitignore`, sem apagar `CLAUDE.md`, `docs/` e `firebase/`. Descartar o `AGENTS.md`/`CLAUDE.md` gerados pelo create-next-app (mantém só o `CLAUDE.md` do projeto).
- [x] `git init` + primeiro commit. Repositório privado criado no GitHub (`pipoleal/cardapio-3d`) e push da `main`.
- [x] Dependências: `firebase firebase-admin next-intl zod @google/model-viewer server-only` · dev: `vitest @firebase/rules-unit-testing`.
- [x] Scripts `typecheck`, `test` e `format`; Prettier (`.prettierrc.json` + `.prettierignore`).
- [x] Config do `firebase init` (Firestore, Storage, Emulators) já existia em `firebase.json`/`firebase/*.rules`; testado com `firebase emulators:start --project demo-cardapio` (Auth, Firestore e Storage sobem OK). `firebase login` + vincular um projeto real ficam como passo manual (ver resumo da Etapa 0).
- [x] `lib/firebase/client.ts` e `lib/firebase/admin.ts` (usando os emuladores quando `NEXT_PUBLIC_USE_EMULATORS=true`).

## Etapa 1 — Multi-tenant + i18n
- [x] `proxy.ts`: host → tenant; rotas do site × loja × painel; locale. Reimplementa a semântica "as-needed" do next-intl em vez de compor `createMiddleware` direto (não dá pra aninhar sob `/loja/<slug>`; motivo comentado em `src/i18n/routing.ts`). Testado em `src/lib/tenant-host.test.ts` e `src/i18n/resolve-locale.test.ts`.
- [x] `next-intl` com pt/en/es e o seletor de idioma (`src/components/ui/LanguageSwitcher.tsx`, pílula PT/EN/ES).
- [x] `lib/tenant.ts` (`getTenantBySlug`, com `React.cache`).
- [x] Design tokens + fontes (Fraunces e DM Sans) conforme `docs/REFERENCIAS-VISUAIS.md`; componentes base (Button, Pill, Card, Chip, Toggle) em `src/components/ui/`.
- [x] Script `scripts/seed.ts`: loja **demo** (confeitaria) com 4 categorias e 10 produtos, capas placeholder geradas em `public/demo/` e alergênicos. Rodar com `npm run seed` (emuladores no ar).

## Etapa 2 — Cardápio público (sem 3D ainda)
- [x] Página da loja **igual ao mockup 01**: cabeçalho, seletor de idioma, faixa "Saiu do forno agora", abas de categoria fixas (sem scroll-spy — só sticky/âncora), cards com selo 3D (condicional, nenhum produto tem modelo ainda), estados "Saiu do forno" e "Esgotado hoje", CTA fixo do WhatsApp.
- [x] Página do produto **igual ao mockup 02** (ainda sem o viewer: usar a foto): preço, "serve N pessoas", tamanhos segmentados, card de alergênicos, CTA fixo. Botão AR escondido (não desabilitado) sem modelo.
- [x] Botão WhatsApp (`lib/whatsapp.ts`) com mensagem traduzida, com testes vitest.
- [x] Tema da loja (cor primária) via CSS variables (aplicado em cada página, não no root layout — ver nota sobre `notFound()` em `docs/DECISOES.md`).
- [x] SEO: `generateMetadata`, Open Graph com a foto do produto/loja, `html lang` dinâmico (root layout próprio da loja, separado de `(main)`).
- [x] Cache do cardápio: `cacheComponents` + `'use cache'`/`cacheTag('tenant:<id>')`/`cacheLife('tenant', 60s)` em `lib/tenant.ts` e `lib/menu.ts`, prontos pra Etapa 3 invalidar com `revalidateTag`.
- [x] `/loja/*` bloqueado no domínio raiz (404); URLs públicas nunca expõem `/loja/<slug>/...`.
- [x] Teste no celular via nip.io (`NEXT_PUBLIC_DEV_EXTRA_DOMAIN`) documentado no README.
- [x] Verificação visual com Playwright (`npm run screenshot`) comparada aos mockups 01/02.

## Etapa 3 — Painel do lojista
- [ ] Layout do painel **igual aos mockups 04/05**: sidebar escura com seletor de loja e navegação.
- [ ] Login (Google + e-mail) e proteção de rotas.
- [ ] CRUD de categorias (arrastar para ordenar) e de produtos (formulário com abas pt/en/es).
- [ ] Upload da capa com compressão.
- [ ] Configurações da loja: nome, WhatsApp, idiomas, cor, logo.
- [ ] Interruptores Esgotado hoje · Saiu do forno · Aceita encomenda; botão "Marcar 'saiu do forno'" na visão geral.
- [ ] Tradução automática (`POST /api/translate`) + fluxo "Aprovar tradução" / "Traduzir de novo" (mockup 05) + página Traduções com o que está pendente. `i18nStatus` é por entidade (ver `docs/MODELO-DE-DADOS.md`): traduzir um produto tem que preencher nome + descrição + nome de **todas** as variações numa tacada só (não campo a campo); o botão também precisa existir pra categorias (nome) e pra loja (descrição + horário de funcionamento + template do WhatsApp).
- [ ] QR code da loja para baixar (PNG/PDF) — ótimo para colocar no balcão.

## Etapa 4 — 3D e AR
- [ ] `ModelProvider` + `MeshyProvider`.
- [ ] Assistente de captura **igual ao mockup 03** (rota "Fotos · IA"; aba "Vídeo · escaneamento" com o selo "em breve").
- [ ] `POST /api/models` e `GET /api/models/[jobId]`, com cópia para o Storage.
- [ ] `ProductViewer` com AR no mockup 02 (testar em Android **e** iPhone reais).
- [ ] Card "Modelo 3D" no editar produto: status, rota, custo, tamanho do arquivo, refazer.
- [ ] Selo "3D" nos cards dos produtos que têm modelo.
- [ ] Limite mensal de gerações por loja.

## Etapa 5 — Analytics
- [ ] `POST /api/track` + helper `track()` no cliente (`sendBeacon`).
- [ ] Visão geral **igual ao mockup 04**: 4 KPIs, produtos mais vistos, idiomas usados, coluna de modelos 3D, filtro de período.
- [ ] Vercel Web Analytics no site do produto.

## Etapa 6 — Site do produto + cadastro
- [ ] Landing no domínio raiz: proposta, vídeo/GIF do AR, link para `demo.`, preços (placeholder), contato via WhatsApp.
- [ ] Cadastro de loja com reserva de subdomínio (`POST /api/tenants`).
- [ ] `/admin` do superadmin + `scripts/set-superadmin.ts`.

## Etapa 7 — Piloto
- [ ] Deploy na Vercel com domínio curinga; Firebase em produção (Blaze + alerta de orçamento).
- [ ] Regras testadas no emulador; `firebase deploy --only firestore:rules,storage`.
- [ ] Cadastrar a confeitaria real e capturar os produtos.
- [ ] Coletar feedback por 2–4 semanas.

## Depois do piloto (backlog)
- Rota "Vídeo · escaneamento" (fotogrametria) · modelo da fatia (alternador Inteiro | Fatia) · compressão GLB (gltf-transform) · editor de escala do modelo
- Sacola de encomenda (vários itens em uma mensagem de WhatsApp)
- Domínio próprio por loja · planos/cobrança · PWA · pedido na mesa
