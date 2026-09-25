# CLAUDE.md — Cardápio 3D

> Sempre responda, pergunte e escreva planos e relatórios em português do Brasil.
>
> Guia para o Claude Code. Leia este arquivo **inteiro** antes de qualquer tarefa.
> Detalhes em `docs/`: ARQUITETURA.md, MODELO-DE-DADOS.md, PIPELINE-3D.md, ROADMAP.md, DECISOES.md.
> **Visual:** `docs/REFERENCIAS-VISUAIS.md` + os PNGs em `docs/referencias-visuais/` são a fonte da verdade do layout. Abra o PNG da tela antes de implementá-la.
> **Next.js:** para APIs do Next.js (ex.: `proxy.ts`, cache, roteamento), confira a documentação da versão instalada em `node_modules/next/dist/docs` antes de usar o que você lembra — a API muda entre versões major e a memória do modelo pode estar desatualizada.

## 1. O produto

Cardápio virtual **multi-loja** em que o cliente final vê os produtos em **3D** e em **AR** (realidade aumentada, no celular) antes de encomendar.

- **Piloto:** uma confeitaria (brigadeiros, tortas doces, croissants doces, bolos). Só depois escalar para outras lojas.
- **Cada loja tem um subdomínio** criado no cadastro: `boaconfe.<DOMINIO>`.
- **Domínio raiz** (`<DOMINIO>`) = site do produto (vitrine/portfólio) com link para a loja demo (`demo.<DOMINIO>`).
- **Encomenda = botão do WhatsApp** (mensagem pré-preenchida). **Não** existe checkout, pagamento nem pedido na mesa nesta fase.
- **3D gerado dentro do site:** o lojista (ou o Felipe, como serviço) tira fotos pelo próprio navegador → uma API de IA (foto → 3D) gera o modelo GLB/USDZ.
- **Idiomas desde o piloto:** português (padrão), inglês e espanhol, com tradução automática que o lojista aprova.
- **"Saiu do forno":** o lojista marca um produto e ele aparece em destaque no topo do cardápio por algumas horas.
- **Alergênicos** por produto (glúten, lactose, ovo, castanhas etc.).
- **Analytics sem custo** no começo.
- Nome do produto e domínio **ainda não definidos**: use `NEXT_PUBLIC_ROOT_DOMAIN` e o nome provisório "Cardápio 3D". Nunca escreva o domínio fixo no código.

## 2. Stack (não troque sem perguntar)

| Camada | Escolha |
|---|---|
| Framework | **Next.js (App Router) + TypeScript (strict)** |
| Estilo | Tailwind CSS (mobile-first) |
| i18n | `next-intl` (pt, en, es) |
| Auth | Firebase Authentication (e-mail/senha + Google) |
| Banco | Cloud Firestore |
| Arquivos | Cloud Storage for Firebase (fotos, GLB, USDZ) |
| Servidor | Route Handlers do Next + **Firebase Admin SDK** (nada de Cloud Functions no piloto) |
| 3D / AR | `<model-viewer>` do Google (`@google/model-viewer`) |
| Foto → 3D | Meshy API (atrás da interface `ModelProvider`, trocável por Tripo etc.) |
| Tradução automática | Google Cloud Translation (servidor, atrás da interface `Translator`) |
| Fontes | Fraunces (títulos) + DM Sans (texto) via `next/font` |
| Validação | `zod` |
| Deploy | Vercel (domínio curinga `*.<DOMINIO>`) |
| Analytics | contadores próprios no Firestore + Vercel Web Analytics (plano grátis) |

## 3. Comandos

```bash
npm run dev          # http://localhost:3000 (site) e http://demo.localhost:3000 (loja)
npm run build
npm run lint
npm run typecheck    # tsc --noEmit (crie o script)
npm run test         # vitest (crie o script)
firebase emulators:start   # auth, firestore, storage locais
```

`*.localhost` já resolve para 127.0.0.1 no Chrome/Edge, então os subdomínios funcionam em dev sem mexer no `hosts`.

## 4. Estrutura de pastas (alvo)

```
src/
  app/
    (site)/                 # domínio raiz: landing, preços, contato, cadastro de loja
    loja/[tenant]/[locale]/ # cardápio público (recebe rewrite do subdomínio)
      page.tsx              # lista de categorias e produtos
      p/[productId]/page.tsx# produto: viewer 3D, botão AR, alergênicos, WhatsApp
    entrar/                 # login (Google/e-mail) — sempre no domínio raiz
    painel/[tenantSlug]/    # área do lojista (autenticada), sempre em <DOMINIO>/painel/<slug>
      produtos/ categorias/ captura/ traducoes/ qrcode/ configuracoes/ #   nunca no subdomínio — ver docs/DECISOES.md
    admin/                  # superadmin (Felipe): todas as lojas, captura como serviço
    api/
      auth/                 # session/signout — troca ID token do SDK web por cookie de sessão httpOnly
      tenants/               # cadastro de loja + reserva de subdomínio
      models/                # criar job 3D, consultar status (polling)
      track/                 # eventos de analytics
  proxy.ts                  # subdomínio → rewrite (no Next < 16 o nome é middleware.ts)
  components/
    menu/ viewer/ capture/ ui/ painel/ auth/
  lib/
    firebase/client.ts      # SDK web (singleton)
    firebase/admin.ts       # Admin SDK (só servidor, "server-only")
    auth/session.ts         # sessão (cookie httpOnly) + posse do tenant, "server-only"
    actions/                # Server Actions do painel (Admin SDK + updateTag) — ver regra 4
    tenant.ts               # resolver loja a partir do host
    three-d/provider.ts     # interface ModelProvider
    three-d/meshy.ts        # implementação Meshy
    translate/provider.ts   # interface Translator (fake em dev, Google em produção)
    whatsapp.ts             # monta link wa.me
    allergens.ts            # lista fixa de alergênicos
    schemas/                # zod: Tenant, User, Category, Product, ModelJob
  i18n/                     # config next-intl
  messages/pt.json en.json es.json
firebase/
  firestore.rules  storage.rules  firestore.indexes.json
docs/
```

## 5. Regras de arquitetura

1. **Multi-tenant pelo host.** O `proxy.ts` lê o `host` e **ignora/sobrescreve qualquer header `x-tenant` vindo do cliente** — o `x-tenant` que os Route Handlers recebem é sempre recalculado pelo proxy a partir do host, nunca repassado da requisição original:
   - `ROOT_DOMAIN` ou `www` → rotas de `(site)`, incluindo `/entrar` (login) e `/painel/<tenantSlug>/...` (área do lojista — **sempre no domínio raiz**, nunca no subdomínio da loja; motivo em `docs/DECISOES.md`).
   - `<slug>.ROOT_DOMAIN` → rewrite para `/loja/<slug>/<locale>/...`; acessar `/painel` nesse subdomínio **redireciona** para `ROOT_DOMAIN/painel/<slug>`.
   - Lista de subdomínios reservados (`www, app, admin, api, painel, static, mail, demo*`) vale **só para o cadastro de loja nova** (`POST /api/tenants` recusa esses slugs) — **não** afeta o roteamento de lojas que já existem. Por isso a loja `demo` (criada pelo seed) é servida normalmente pelo proxy, como qualquer outra.
2. **Toda consulta de loja é filtrada por `tenantId`.** Os dados moram em `tenants/{tenantId}/...`. Nunca faça consulta sem o tenant.
3. **Chaves secretas só no servidor** (`MESHY_API_KEY`, credenciais do Admin SDK). Arquivos que usam isso importam `server-only`.
4. **Firestore lido no cliente só para dados públicos** (cardápio) ou pra arquivo já enviado ao Storage (upload de capa/logo usa o SDK web direto, protegido por `storage.rules`). **Toda escrita de dado passa pelo servidor**: Server Actions com Admin SDK pro CRUD do painel (`lib/actions/`, sempre confere sessão + posse do tenant antes de gravar, e termina com `updateTag(\`tenant:<id>\`)` — não `revalidateTag`, que exige um segundo argumento nesta versão e não é o recomendado dentro de Server Actions); Route Handlers com Admin SDK pra sessão de login (`/api/auth/*`) e pro que não é uma mutação de formulário. `firebase/firestore.rules`/`storage.rules` continuam valendo como segunda camada de defesa (testadas no emulador), mesmo não sendo mais o caminho principal de escrita.
5. **Cardápio público renderizado no servidor** (RSC) com `revalidate` curto (60 s) ou `revalidateTag` quando o lojista salva; tem que abrir rápido no 4G.
6. **Preço em centavos (inteiro)**, moeda `BRL`, formatado com `Intl.NumberFormat` conforme o locale.
7. **Textos traduzíveis** são objetos `{ pt, en?, es? }`. Fallback: locale pedido → `pt`.
8. **Modelos 3D sempre copiados para o nosso Storage**: as URLs da Meshy expiram, então nunca salve a URL deles como definitiva.
9. **`<model-viewer>` só no cliente** (`dynamic(..., { ssr: false })`), carregado sob demanda (lazy) e com `poster` enquanto baixa.
10. **Acessibilidade e mobile primeiro:** alvo de toque ≥ 44px, `alt` em imagens, contraste AA.
11. **Design tokens** (cores, fontes, raios) de `docs/REFERENCIAS-VISUAIS.md` no `@theme` do Tailwind; nada de hex solto nos componentes.

## 6. Convenções de código

- TypeScript strict, sem `any` (use `unknown` + zod).
- Componentes em PascalCase, arquivos de componente `.tsx` com o mesmo nome; hooks `useX.ts`.
- Server Components por padrão; `"use client"` só onde precisa.
- Código e identificadores em **inglês**; textos de UI **sempre via next-intl** (nada de string solta na UI); comentários podem ser em português.
- Datas no Firestore: `Timestamp` do servidor (`FieldValue.serverTimestamp()`).
- Erros de API: `{ error: { code, message } }` com status HTTP correto.
- Commits pequenos, no estilo Conventional Commits (`feat:`, `fix:`, `chore:`).

## 7. Variáveis de ambiente

Veja `.env.example`. Nunca faça commit do `.env.local`.

## 8. Como trabalhar neste repo (para o Claude Code)

- Siga o **ROADMAP.md** em ordem; ao terminar uma etapa, marque o checkbox e rode `lint`, `typecheck` e `build`.
- Antes de mudar o modelo de dados, atualize `docs/MODELO-DE-DADOS.md` e as regras em `firebase/`.
- Mudanças nas regras do Firestore/Storage precisam de teste no emulador (`@firebase/rules-unit-testing`).
- Na dúvida sobre regra de negócio, **pergunte ao Felipe** em vez de inventar.
- Registre decisões novas em `docs/DECISOES.md`.
- O projeto antigo **BoaPedida** (Django, em `C:\Users\felip\BoaPedida`) serve **só de referência** de UX e de modelo de cardápio. Não copie código de lá.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
