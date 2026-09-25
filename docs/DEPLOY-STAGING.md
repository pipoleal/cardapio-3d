# Deploy de staging (Vercel + Firebase real)

> Checklist pra subir um ambiente de teste com Firebase de verdade (não o emulador) na Vercel,
> antes do domínio final e antes da Etapa 6 (cadastro de loja pelo site). Quem executa isso é o
> Felipe — nada aqui roda sozinho.

## 1. Projeto Firebase real

Criar um projeto novo no [console do Firebase](https://console.firebase.google.com) (não reaproveitar o
`demo-cardapio` do emulador). Ativar:

- **Authentication** — provedores e-mail/senha e Google.
- **Firestore** (modo produção).
- **Storage**.
- Plano **Blaze** (necessário pro Storage e pro Admin SDK falar com o Firebase de fora do
  emulador) + um alerta de orçamento (Billing → Budgets & alerts) pra não levar susto.

## 2. Variáveis de ambiente na Vercel

Project Settings → Environment Variables. Todas as de `.env.example`, com valores reais:

- `NEXT_PUBLIC_FIREBASE_*` — em Project Settings → General → "Your apps" (SDK web) do console.
- `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` — gerar
  uma conta de serviço em Project Settings → Service accounts → "Generate new private key".
- `NEXT_PUBLIC_USE_EMULATORS=false`.
- `NEXT_PUBLIC_ROOT_DOMAIN=<domínio de staging>` (ver seção 6).
- `MODEL_PROVIDER=meshy` + `MESHY_API_KEY` — **cuidado com custo**: cada geração gasta crédito de
  verdade. Considere deixar `MODEL_PROVIDER=fake` em staging até o dia de testar a Meshy/AR de
  verdade, e trocar só nesse dia.
- `MESHY_CREDIT_PRICE_CENTS`, `TRANSLATOR_PROVIDER=google`, `FRESH_HOURS`.

## 3. Domínios autorizados no Firebase Auth

Authentication → Settings → Authorized domains: adicionar o **domínio raiz** de staging (o painel/
login só roda lá, nunca no subdomínio da loja — decisão nº 16 em `DECISOES.md`, Firebase Auth não
aceita curinga `*.dominio` nessa lista).

Se for testar antes do domínio final estar apontado, por uma URL da própria Vercel: use a
**URL fixa da branch** (Vercel Git Integration dá um alias estável por branch, no formato
`<projeto>-git-<branch>-<time>.vercel.app`, que não muda a cada deploy) — **nunca** a URL de um
deploy específico (`<projeto>-<hash>-<time>.vercel.app`), que muda a cada `git push` e obrigaria
reconfigurar o Auth toda hora.

## 4. Regras e índices

```
firebase deploy --only firestore:rules,storage,firestore:indexes --project <projeto-staging>
```

As regras já são testadas no emulador (`npm run test:rules`) antes de qualquer deploy.

## 5. CORS do Storage

Upload de capa/logo/captura sai do navegador direto pro Storage (SDK web), mas **só acontece no
painel**, que só roda no domínio raiz — não precisa (e o Google Cloud Storage não aceita) curinga
de subdomínio aqui:

```
gcloud storage buckets update gs://<bucket> --cors-file=firebase/storage-cors.json
```

Ajustar `firebase/storage-cors.json` com o domínio raiz de staging de verdade antes de rodar
(o arquivo no repo é só um modelo com um domínio de exemplo).

## 6. Domínio + subdomínio curinga

A Vercel **não dá subdomínio curinga em `*.vercel.app`** — cada deploy tem sua própria URL, não
controlável pelo app. Testar multi-tenant por subdomínio em staging exige um domínio de verdade
(nem que seja barato/temporário):

1. Comprar/usar um domínio (ex. um `.xyz` barato).
2. Vercel → Project → Domains → adicionar `staging.<domínio>` **e** `*.staging.<domínio>`.
3. No DNS do domínio, criar `CNAME *.staging.<domínio> → cname.vercel-dns.com` (a Vercel mostra o
   valor exato na hora de adicionar o domínio).

Sem atalho gratuito só com o domínio da Vercel — mesma limitação que já descartou usar ngrok no
dev (ver decisão nº 20, mkcert).

## 7. Cadastro de loja sem a Etapa 6 pronta

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
antes de confirmar.

## 8. Build

`next build` já foi validado nesta sessão (Etapa 4 e 5) — nenhuma configuração nova de build é
necessária além das variáveis de ambiente acima.
