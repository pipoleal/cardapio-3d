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

## Pendências
- Nome do produto e domínio.
- Plano de preços para as lojas.
- Vercel Hobby × Pro quando começar a cobrar.
