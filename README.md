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
npm run emulators   # Auth (9099), Firestore (8080), Storage (9199) — UI em http://127.0.0.1:4000
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
