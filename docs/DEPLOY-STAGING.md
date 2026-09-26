# Deploy de staging (Vercel + Firebase real + Vercel Blob)

> Checklist pra subir um ambiente de teste com Firestore/Auth de verdade (não o emulador) e Vercel
> Blob (não o Firebase Storage — ver seção 1) na Vercel, antes do domínio final e antes da Etapa 6
> (cadastro de loja pelo site). Quem executa isso é o Felipe — nada aqui roda sozinho.

## 1. Projeto Firebase real (Firestore + Auth, sem Storage)

Criar um projeto novo no [console do Firebase](https://console.firebase.google.com) (não reaproveitar o
`demo-cardapio` do emulador). Ativar:

- **Authentication** — provedores e-mail/senha e Google.
- **Firestore** (modo produção, região `southamerica-east1`).

**Sem Cloud Storage aqui** — o armazenamento de arquivo (capa, logo, fotos de captura, GLB/USDZ/
poster) usa o **Vercel Blob** (seção 3), não o Firebase. Isso é de propósito: Cloud Storage exige o
plano **Blaze** do Firebase (cartão de crédito/CNPJ), que não dá pra ativar agora — Firestore e
Auth funcionam no plano Spark (grátis) sem Blaze. Ver `docs/DECISOES.md`.

## 2. Variáveis de ambiente na Vercel

Project Settings → Environment Variables. Todas as de `.env.example`, com valores reais:

- `NEXT_PUBLIC_FIREBASE_*` — em Project Settings → General → "Your apps" (SDK web) do console.
  `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` pode ficar vazio/qualquer coisa — não é usado
  (`STORAGE_PROVIDER=vercel-blob`, não fala com o Storage do Firebase).
- `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` — gerar
  uma conta de serviço em Project Settings → Service accounts → "Generate new private key".
- `NEXT_PUBLIC_USE_EMULATORS=false`.
- `NEXT_PUBLIC_ROOT_DOMAIN=<domínio de staging>` (ver seção 6).
- `NEXT_PUBLIC_PATH_TENANT_MODE=true` — enquanto não tem domínio com subdomínio curinga (seção 7),
  acessa a loja por `<host>/l/<slug>` em vez de `<slug>.<host>` (decisão nº 26).
- `STORAGE_PROVIDER=vercel-blob` e `NEXT_PUBLIC_STORAGE_PROVIDER=vercel-blob` (seção 3).
- `MODEL_PROVIDER=meshy` + `MESHY_API_KEY` — **cuidado com custo**: cada geração gasta crédito de
  verdade. Considere deixar `MODEL_PROVIDER=fake` em staging até o dia de testar a Meshy/AR de
  verdade, e trocar só nesse dia.
- `MESHY_CREDIT_PRICE_CENTS`, `TRANSLATOR_PROVIDER=google`, `FRESH_HOURS`.
- `MESHY_WEBHOOK_SECRET` (opcional — seção 4).

## 3. Vercel Blob: dois stores (público e privado)

Um store Blob nasce público OU privado — não dá pra misturar nem trocar depois de criado — por
isso são **dois stores**, um pra cada nível de acesso. Os stores **`cardapio-3d-public`** e
**`cardapio-3d-private`** (região `gru1`) já existem — só falta **conectar** ao projeto:

1. Project → Storage → selecionar o store existente → **Connect Project**.
   - `cardapio-3d-public` (access **Public**): conectar com o prefixo de env var
     `BLOB_READ_WRITE_TOKEN_PUBLIC` (Advanced Options ao conectar) — cobre capa, logo e o upload
     manual de modelo 3D.
   - `cardapio-3d-private` (access **Private**): conectar com o prefixo
     `BLOB_READ_WRITE_TOKEN_PRIVATE` — cobre as fotos de captura (nunca públicas).
2. Marcar os ambientes **Production**, **Preview** e (se for testar local antes do deploy, ver
   abaixo) **Development** ao conectar cada store.
3. Testar local antes do deploy: `vercel env pull` copia os tokens reais pro `.env.local` — troque
   `STORAGE_PROVIDER`/`NEXT_PUBLIC_STORAGE_PROVIDER` pra `vercel-blob` lá (comentado por padrão, ver
   `.env.local`). **Limitação conhecida:** o callback `onUploadCompleted` do Blob não alcança
   `localhost` (precisa de uma URL https pública) — não afeta nada aqui, porque o app não depende
   desse callback pra persistir a URL do upload (o cliente já chama a Server Action assim que
   `upload()` resolve, ver `lib/storage/upload-client.ts`); só significa que, testando local, o
   log do `onUploadCompleted` no servidor nunca aparece — normal, ignorar.

Limites do plano Hobby (grátis) do Vercel Blob — conferidos na documentação (`vercel.com/docs/vercel-blob/usage-and-pricing`, 2026-09): 1 GB de armazenamento, 2.000 operações avançadas
(`put`/`upload`/`copy`/`list`) e 10.000 simples (leitura com cache MISS) por mês, 10 GB de
transferência. Estourar não cobra nada — só bloqueia o Blob por 30 dias. Ver `docs/DECISOES.md`.

## 4. Webhook opcional pra finalizar jobs 3D mais rápido

`POST /api/models/webhook/[provider]` finaliza um job assim que o provider termina, sem esperar o
`ModelJobsPoller` sondar — o polling continua funcionando de qualquer jeito, isso é só uma
otimização. Pra ligar pra Meshy:

1. Gerar um segredo qualquer (ex. `openssl rand -hex 32`) e salvar como `MESHY_WEBHOOK_SECRET` na
   Vercel.
2. No dashboard da Meshy (API settings → Webhooks → Create Webhook), configurar a URL:
   `https://<domínio-de-staging>/api/models/webhook/meshy?token=<o mesmo segredo>`.
   **A Meshy não assina webhooks** (confirmado na documentação — sem header de assinatura nem
   segredo compartilhado nativo), por isso o segredo vai na própria URL: é a única autenticação
   possível, e só nós sabemos essa URL completa.
3. **Verificar depois de configurar:** a doc da Meshy não dá um exemplo exato do payload do
   webhook (só diz que é "o objeto da task") — o código (`src/app/api/models/webhook/[provider]/route.ts`)
   tenta os campos mais prováveis pro id da task (`id`, `task_id`, `result`); se a primeira entrega
   real não bater, inspecionar o payload (log temporário) e ajustar esse trecho.

Serve também pro futuro worker 3D próprio (Modal) — o mesmo endpoint, só com um provider novo e
`MODAL_WEBHOOK_SECRET`.

## 5. Domínios autorizados no Firebase Auth

Authentication → Settings → Authorized domains: adicionar o **domínio raiz** de staging (o painel/
login só roda lá, nunca no subdomínio da loja — decisão nº 16 em `DECISOES.md`, Firebase Auth não
aceita curinga `*.dominio` nessa lista).

Antes do domínio final estar apontado, usar `vercel --prod` (não um deploy de preview/branch) —
isso dá a URL fixa do **projeto** (`<projeto>.vercel.app`, sem hash nem nome de branch), que não
muda entre deploys. Essa é a URL que vai em `NEXT_PUBLIC_ROOT_DOMAIN` e nos domínios autorizados do
Auth. (Uma URL de deploy específico, `<projeto>-<hash>-<time>.vercel.app`, muda a cada `git push` e
obrigaria reconfigurar o Auth toda hora — evitar.)

## 6. Regras e índices do Firestore

```
firebase deploy --only firestore:rules,firestore:indexes --project <projeto-staging>
```

(Sem `storage` aqui — `storage.rules` só vale pro emulador local, ver o comentário no topo do
arquivo.) As regras já são testadas no emulador (`npm run test:rules`) antes de qualquer deploy.

## 7. Domínio + subdomínio curinga

A Vercel **não dá subdomínio curinga em `*.vercel.app`** — cada deploy tem sua própria URL, não
controlável pelo app. Testar multi-tenant por subdomínio de verdade em staging exige um domínio
próprio (nem que seja barato/temporário):

1. Comprar/usar um domínio (ex. um `.xyz` barato).
2. Vercel → Project → Domains → adicionar `staging.<domínio>` **e** `*.staging.<domínio>`.
3. No DNS do domínio, criar `CNAME *.staging.<domínio> → cname.vercel-dns.com` (a Vercel mostra o
   valor exato na hora de adicionar o domínio).

Sem atalho gratuito só com o domínio da Vercel — mesma limitação que já descartou usar ngrok no
dev (ver decisão nº 20, mkcert).

**Enquanto não tem esse domínio**: `NEXT_PUBLIC_PATH_TENANT_MODE=true` (decisão nº 26) dá acesso à
loja por `<host>/l/<slug>/...` na própria URL fixa `.vercel.app` — cobre o teste no celular (painel,
captura, cardápio, QR code) sem esperar um domínio próprio. Trocar pra `false` quando o domínio com
subdomínio curinga estiver configurado (produção de verdade nunca usa esse modo).

## 8. Cadastro de loja sem a Etapa 6 pronta

A Etapa 6 (cadastro de loja pelo site, `POST /api/tenants`) ainda não existe. Dois scripts cobrem
isso manualmente em staging — **os dois pedem confirmação no terminal antes de gravar**, mostrando
o projeto Firebase de destino (nunca gravam num projeto real sem o operador confirmar):

```bash
# Loja vazia + usuário dono, pra cadastrar uma loja real em staging
npm run create-tenant -- boaconfe "Boa Confeitaria" dona@example.com

# A MESMA loja de demonstração do emulador (bolos, tortas, brigadeiros), útil pra
# mostrar o produto sem esperar um cliente real
npm run seed-real
```

Os dois leem as env vars normais (`.env.local` ou o ambiente da Vercel via `vercel env pull`) —
rodam contra **qualquer** projeto que essas variáveis apontarem, então confira `FIREBASE_ADMIN_PROJECT_ID`
antes de confirmar. `seed-real` grava só no Firestore (categorias/produtos) — as fotos de capa
placeholder (`public/demo/*.svg`) continuam sendo servidas do próprio deploy, não precisam de
upload nenhum pro Blob.

## 9. Build

`next build` já foi validado nesta sessão — nenhuma configuração nova de build é necessária além
das variáveis de ambiente acima.
