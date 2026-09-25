# Cardápio 3D (nome provisório)

Cardápio virtual multi-loja com produtos em 3D e AR. Piloto: confeitaria.

- Guia para o Claude Code: [CLAUDE.md](CLAUDE.md)
- Arquitetura: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)
- Modelo de dados: [docs/MODELO-DE-DADOS.md](docs/MODELO-DE-DADOS.md)
- Pipeline 3D: [docs/PIPELINE-3D.md](docs/PIPELINE-3D.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Referências visuais: [docs/REFERENCIAS-VISUAIS.md](docs/REFERENCIAS-VISUAIS.md)

## Começar
1. Abra esta pasta no VS Code.
2. No Claude Code: *"Leia o CLAUDE.md e execute a Etapa 0 do docs/ROADMAP.md."*

## Rodando local sem Firebase real

Não precisa criar nada no [console do Firebase](https://console.firebase.google.com) nem
rodar `firebase login` só para desenvolver: o `.env.local` (não versionado — copie de
`.env.example` se precisar recriar) já aponta para o projeto `demo-cardapio`, que só existe
nos emuladores. `lib/firebase/admin.ts` não pede credencial real quando
`NEXT_PUBLIC_USE_EMULATORS=true`, só o `projectId`.

Em dois terminais:

```bash
npm run emulators   # Auth (9099), Firestore (8080), Storage (9199) — UI em http://127.0.0.1:4001
npm run dev          # http://localhost:3000
```

Depois de subir os emuladores (num terceiro terminal, ou depois que o primeiro comando
acabar de imprimir "All emulators ready"), popule a loja de exemplo:

```bash
npm run seed
```

Isso cria o tenant **demo** (uma confeitaria: brigadeiros, tortas, croissants, bolos — 4
categorias, 10 produtos) e gera capas placeholder em `public/demo/`. Depois é só abrir:

- **http://localhost:3000** — site (landing, com link para a loja demo)
- **http://demo.localhost:3000** — a loja demo (`*.localhost` já resolve para 127.0.0.1 no
  Chrome/Edge, não precisa mexer no `hosts`)
- **http://demo.localhost:3000/en** ou **/es** — troca de idioma (também dá pra clicar na
  pílula PT/EN/ES no topo da página)

Os dados dos emuladores **não são persistidos** entre reinícios — depois de parar e subir o
`npm run emulators` de novo, rode `npm run seed` outra vez.

Quando for conectar num projeto Firebase de verdade (piloto em produção, por exemplo):
`firebase login`, `firebase use --add`, preencha as chaves reais no `.env.local` e apague
`NEXT_PUBLIC_USE_EMULATORS` (ou deixe `false`).

## Rodando no celular

Pra abrir o cardápio no celular (mesma Wi-Fi do PC), usa
[nip.io](https://nip.io) — resolve `qualquercoisa.<seu-ip>.nip.io` pro próprio IP, sem mexer
em roteador nem `hosts`.

### 1. Básico (HTTP) — cardápio, painel, captura por seletor de foto

1. Descubra o IP local do PC na sua rede (`ipconfig`, procure o "Endereço IPv4" do Wi-Fi/Ethernet
   — ex.: `192.168.1.9`).
2. No `.env.local`, adicione (mantendo o `NEXT_PUBLIC_ROOT_DOMAIN` como está — os dois
   funcionam ao mesmo tempo):
   ```env
   NEXT_PUBLIC_DEV_EXTRA_DOMAIN=192.168.1.9.nip.io:3000
   NEXT_PUBLIC_EMULATOR_HOST=192.168.1.9
   ```
   `NEXT_PUBLIC_EMULATOR_HOST` é necessário pros emuladores (Auth/Firestore/Storage) — sem ele,
   o celular tentaria falar com `127.0.0.1`, que no celular é ele mesmo, não o PC.
   `firebase.json` já está configurado com `"host": "0.0.0.0"` nos 4 emuladores (aceitam
   conexão de qualquer IP da rede, não só do próprio PC).
3. Reinicie `npm run emulators` e `npm run dev` (mudança de env var não recarrega sozinha).
4. No celular, abra **http://demo.192.168.1.9.nip.io:3000** (troque pelo seu IP).

Nesse modo (HTTP simples) já funcionam: cardápio público, login (Auth emulator — é local, não
fala com o Google de verdade, então não exige HTTPS), painel completo, e a **captura de fotos
pelo seletor nativo da câmera** (`<input capture="environment">` — é o app de câmera do sistema
operacional, não pede contexto seguro). As fotos/GLB/USDZ salvos no Storage do emulador também
abrem certo no celular graças ao rewrite `/__storage/*` (`next.config.ts`) — sem ele, a URL
salva apontaria pro `127.0.0.1` do próprio PC.

Se não conectar, o Firewall do Windows pode estar bloqueando — na primeira vez que o
`next dev`/`firebase emulators:start` sobe, o Windows costuma perguntar se libera a rede
privada; aceite. `demo.localhost` continua funcionando normalmente no PC ao mesmo tempo.

### 2. HTTPS (mkcert) — câmera ao vivo e AR

**Câmera ao vivo** (`getUserMedia`, overlay guiado na tela de captura) e **AR** (WebXR no
Android, Quick Look no iPhone) só funcionam em contexto seguro — HTTPS de verdade, não basta
estar na mesma rede. A solução é gerar um certificado local confiável com
[mkcert](https://github.com/FiloSottile/mkcert):

1. Instale o mkcert (`choco install mkcert` no Windows, ou baixe o binário) e rode
   `mkcert -install` uma vez (registra uma CA local confiável no seu PC/navegador).
2. Gere o certificado, cobrindo `localhost` e o domínio nip.io da rede local — com curinga pros
   subdomínios de loja:
   ```
   mkdir certs
   mkcert -cert-file certs/dev-cert.pem -key-file certs/dev-key.pem localhost "*.localhost" 192.168.1.9.nip.io "*.192.168.1.9.nip.io"
   ```
   (`certs/` já está no `.gitignore` — a chave privada nunca vai pro repo.)
3. Rode `npm run dev:https` em vez de `npm run dev`.
4. Instale a CA raiz do mkcert **no celular** (passo manual, uma vez só): rode `mkcert -CAROOT`
   no PC pra achar o `rootCA.pem`, e mande esse arquivo pro celular (e-mail, Drive, AirDrop).
   - **Android:** Ajustes → Segurança → Criptografia e credenciais → Instalar certificado →
     Autoridade de certificação → selecione o arquivo.
   - **iPhone:** abra o arquivo (baixa um perfil) → Ajustes → Perfil baixado → Instalar →
     **depois**, separadamente, Ajustes → Geral → Sobre → Confiança de certificado → ative a
     confiança total pro certificado do mkcert.
5. No celular, abra **https://demo.192.168.1.9.nip.io:3000** (mesmo IP, agora `https://`).

O IP local muda de vez em quando (troca de rede, reinício do roteador) — quando mudar, só
regerar o certificado (passo 2) com o IP novo.

**Resumo do que testar em cada modo:**

| Fluxo | HTTP (nip.io simples) | HTTPS (mkcert) |
|---|---|---|
| Cardápio público, painel, login | ✅ | ✅ |
| Captura por seletor nativo (`capture="environment"`) | ✅ | ✅ |
| Captura por câmera ao vivo (`getUserMedia`, overlay guiado) | ❌ (cai no seletor nativo automaticamente) | ✅ |
| AR ("Ver na sua mesa") | ❌ | ✅ |

## Verificação visual (Playwright)

Screenshots do cardápio e da página de produto em 390px, pra comparar com os mockups em
`docs/referencias-visuais/`. Não é um teste automatizado (não falha o CI) — é uma checagem
manual pontual.

```bash
npx playwright install chromium   # uma vez só
npm run screenshot                 # precisa de emuladores + seed + dev (ou build+start) rodando
```

Salva em `screenshots/` (fora do git — pasta local, cada um tira a sua).

## Deploy de staging

Checklist completo pra subir um ambiente de teste na Vercel com Firebase real (variáveis de
ambiente, domínios autorizados no Auth, regras, CORS do Storage, subdomínio curinga sem domínio
próprio ainda) em `docs/DEPLOY-STAGING.md`.
