# Registro de decisões

| # | Data | Decisão | Motivo |
|---|---|---|---|
| 1 | 2026-09 | Next.js + Firebase | Stack escolhida pelo Felipe; Firebase dá auth, banco e storage sem backend próprio |
| 2 | 2026-09 | BoaPedida (Django) só como referência | Stack diferente; aproveitar o modelo de cardápio e a UX, não o código |
| 3 | 2026-09 | Multi-tenant por subdomínio (`slug.<DOMINIO>`) | Cada loja com endereço próprio, fácil de divulgar |
| 4 | 2026-09 | Encomenda pelo WhatsApp, sem checkout | Piloto simples; pedido na mesa fica para depois |
| 5 | 2026-09 | pt/en/es desde o piloto | Requisito do Felipe |
| 6 | 2026-09 | 3D por IA foto→3D (Meshy) atrás da interface `ModelProvider` | Captura simples para o lojista (até 4 fotos); dá para trocar por fotogrametria depois |
| 7 | 2026-09 | `<model-viewer>` para 3D/AR | AR no Android (Scene Viewer/WebXR) e no iOS (Quick Look) sem app |
| 8 | 2026-09 | Route Handlers + Admin SDK em vez de Cloud Functions | Menos infraestrutura no piloto; tudo no deploy da Vercel |
| 9 | 2026-09 | Analytics com contadores próprios no Firestore | Custo zero, sem dado pessoal (LGPD) |
| 10 | 2026-09 | Mockups do piloto (5 telas) como fonte da verdade visual | Padroniza a UI para o Claude Code; tokens em REFERENCIAS-VISUAIS.md |
| 11 | 2026-09 | Tradução automática com aprovação já no piloto | Aparece no mockup 05; o cliente só vê textos aprovados |
| 12 | 2026-09 | Captura: piloto só com "Fotos · IA"; "Vídeo · escaneamento" fica "em breve" | Mantém a decisão nº 6; o mockup já prevê as duas rotas |
| 13 | 2026-09 | `cacheComponents: true` (Next 16) em vez de `unstable_cache` | `unstable_cache` está oficialmente substituído; dados de tenant/cardápio usam `'use cache'` + `cacheTag('tenant:<id>')` + `cacheLife('tenant', 60s)`, prontos pra `revalidateTag` na Etapa 3. "Saiu do forno" é calculado fora da função cacheada (`Date.now()` depois de `connection()`, dentro de `<Suspense>`), senão o selo ficava preso no cache |
| 14 | 2026-09 | Dois root layouts: `(main)` (site/painel/admin, `html lang="pt"` fixo) e `loja/[tenant]/[locale]` (próprio, `html lang` dinâmico) | Só o root layout controla `<html>`; sem isso o `lang` da loja nunca mudava por idioma. Custo zero de UX: a troca entre os dois é sempre troca de subdomínio, já era full page load |
| 15 | 2026-09 | `notFound()` de tenant/produto fica nas páginas, nunca no root layout da loja | Descoberto na prática: `notFound()` disparado dentro do root layout (o que define `<html>`) quebra o App Shell do PPR quando o tenant não está em `generateStaticParams` — o shell já foi enviado sem `<html>` pra substituir. O layout só confere o `locale` (3 valores fixos); cada página confere o tenant/produto e o tema (`--color-accent`) é aplicado por página, não no `<body>` do layout |
| 16 | 2026-09 | Painel do lojista no domínio raiz (`<DOMINIO>/painel/<slug>`), não mais no subdomínio da loja | Firebase Authentication não aceita domínio curinga na lista de "domínios autorizados" — cada subdomínio de loja precisaria ser cadastrado individualmente (manual ou via Admin API a cada loja nova) e teria sessão de login separada; confirmado pesquisando a documentação oficial e relatos consistentes da comunidade Firebase (nenhum suporte a wildcard documentado) antes de decidir. Login único em `<DOMINIO>/entrar`; seletor de loja na sidebar troca entre os tenants do usuário (ou todos, se superadmin); `/painel` no subdomínio da loja passa a redirecionar pro painel no domínio raiz |
| 17 | 2026-09 | Redirect de `/painel` (subdomínio → domínio raiz) é HTML/JS no corpo (status 200), não `NextResponse.redirect()` | Bug real, reproduzido: um redirect cross-host emitido pelo `proxy.ts` (middleware) vira loop infinito no servidor de dev/self-hosted do Next — `resolve-routes.js` "relativiza" o `Location` comparando contra um `initUrl` montado com o hostname de BIND do servidor (ex. "localhost"), não o `Host:` de verdade da requisição, então `http://localhost:3000/painel/demo` (vindo de `demo.localhost:3000`) é tratado como "mesma origem" e o `Location` vira relativo, resolvido pelo navegador de volta pro subdomínio → cai no mesmo redirect de novo. Devolver a navegação como `<meta http-equiv="refresh">` + `location.replace()` (status 200, nunca passa por esse pós-processamento de redirect) contorna isso em qualquer ambiente — ver `proxy.ts`, `redirectViaHtml` |
| 18 | 2026-09 | `next.config.ts` precisa de `images.remotePatterns` pro Storage (emulador `127.0.0.1:9199` em dev + `firebasestorage.googleapis.com` em produção) | Bug real, reproduzido: o upload de capa de produto pelo painel (Etapa 3) gerava uma URL do Storage que o `next/image` recusava (host não configurado) — isso não dava só um ícone quebrado, **derrubava a renderização da página inteira do cardápio público** pro cliente final. `search` fica de fora do padrão de propósito: o token de download (`?alt=media&token=...`) muda a cada arquivo |

## Pendências
- Nome do produto e domínio.
- Plano de preços para as lojas.
- Vercel Hobby × Pro quando começar a cobrar.
