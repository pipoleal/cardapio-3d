# Referências visuais (mockups do piloto)

Arquivos em `docs/referencias-visuais/`:

| Arquivo | Tela | Tamanho de referência |
|---|---|---|
| `01-cliente-cardapio.png` | Cliente · lista do cardápio | celular 390px |
| `02-cliente-produto-3d-ar.png` | Cliente · produto em 3D/AR | celular 390px |
| `03-dono-captura-guiada.png` | Dono · captura 3D guiada | celular 390px |
| `04-dono-visao-geral.png` | Dono · painel, visão geral | desktop 1440px |
| `05-dono-editar-produto-traducoes.png` | Dono · editar produto e traduções | desktop 1440px |
| `mockups-piloto.html` | As 5 telas juntas (abrir no navegador) | — |

> **Regra para o Claude Code:** ao implementar qualquer uma dessas telas, **abra o PNG correspondente** e siga o layout, a hierarquia, os espaçamentos e os textos. Textos entre colchetes (`[PREÇO]`, `[Nome da Confeitaria]`, `[00]`) são dados dinâmicos. Os ícones dos produtos no mockup são placeholders: no app real entram a foto de capa ou o poster do modelo.

## Design tokens

Configure no Tailwind (`@theme` no `globals.css`) e use sempre pelo nome, nunca o hex solto.

| Token | Hex | Uso |
|---|---|---|
| `--color-bg` | `#F6EFE6` | fundo do cardápio (cliente) |
| `--color-bg-panel` | `#FAF7F2` | fundo da área principal do painel |
| `--color-surface` | `#FFFDF9` | cards, inputs, pílulas inativas |
| `--color-ink` | `#2A1C15` | texto principal, sidebar, pílula ativa, card de KPI em destaque |
| `--color-muted` | `#6B5A4E` | textos secundários, rótulos |
| `--color-border` | `#E6D9C8` | bordas de cards e inputs, trilho de barras |
| `--color-accent` | `#9C3D27` | CTA do WhatsApp, "Salvar e publicar", selo "Saiu do forno", links "Capturar agora" |
| `--color-accent-soft` | `#C27A5A` | segunda cor de gráfico (ex.: inglês na barra de idiomas) |
| `--color-success` | `#2F5D50` | "Publicado", selo "Pronto" |
| `--color-warning` | `#6A4A10` | "Processando", aviso de tradução automática |
| `--color-thumb-1/2/3` | `#EFD9C6` `#F0DDB8` `#E3CFC2` | fundo das miniaturas por categoria |
| `--color-capture-bg` | `#17110D` | tela de captura (modo escuro) |
| `--color-capture-surface` | `#2A211B` | área da câmera |
| `--color-capture-highlight` | `#F2C9B8` | anel de progresso, etapa ativa |
| `--color-rec` | `#B3261E` | botão e selo de gravação |

A cor principal da loja (`tenant.theme.primary`) substitui `--color-accent` por loja. O padrão é `#9C3D27`.

### Tipografia (Google Fonts via `next/font`)
- **Fraunces 600:** títulos (nome da loja 28px, título de seção 22px, nome do produto 28px, título do painel 30–34px, KPIs 32px).
- **DM Sans 400/500/600:** todo o resto (corpo 14–16px, rótulos 12–13px, eyebrow "CARDÁPIO" 12px com letter-spacing em caixa alta).

### Formas
- Pílulas (idioma, categorias, selos, chips de alergênico): `rounded-full`.
- Cards: raio de 16px, borda de 1px `--color-border`, sem sombra (ou uma sombra bem sutil).
- Miniaturas: raio de 12px. Inputs e botões do painel: raio de 10px. CTA do cliente: raio de 12px, altura de 52px, largura total.

## Tela a tela

### 01 · Cardápio (cliente)
- Eyebrow "CARDÁPIO" + nome da loja (Fraunces) à esquerda; seletor **PT / EN / ES** em pílula à direita.
- **Faixa "Saiu do forno agora"** (card com ponto na cor de destaque): mostra os produtos marcados como recém-saídos.
- Abas de categoria em pílulas, com rolagem horizontal e fixas no topo ao rolar; a ativa fica preenchida com `--color-ink`.
- Seções por categoria (título em Fraunces). Card de produto: miniatura de 96px com o **selo "3D"** no canto, nome em negrito, descrição de 2 linhas, "Contém: …" / "Pode conter: …" e o preço.
- Estados: selo "Saiu do forno" (accent); **"Esgotado hoje"** (card com opacidade reduzida, sem preço).
- **CTA fixo no rodapé:** "Encomendar pelo WhatsApp" (encomenda geral da loja).

### 02 · Produto em 3D/AR (cliente)
- Topo: voltar · nome da loja · seletor de idioma.
- Viewer grande (raio de 24px, fundo `--color-bg` mais escuro), com o selo "Modelo 3D" e o alternador **Inteiro | Fatia** (só aparece se o produto tiver o modelo da fatia), e a dica "Arraste para girar · pinça para zoom".
- Botão com contorno **"Ver na sua mesa (AR)"** logo abaixo do viewer.
- Nome (Fraunces), preço + **"serve [n] pessoas"**, descrição.
- **Tamanho:** botões segmentados (variações); o selecionado ganha borda de 2px `--color-ink`.
- Card de **Alergênicos** com ícone de alerta, chips e a linha "Pode conter traços de…".
- CTA fixo: "Encomendar pelo WhatsApp" + a legenda "A mensagem já vai com o nome do bolo e o tamanho".

### 03 · Captura guiada (dono)
- Tela escura em tela cheia. Fechar (X) · "Captura guiada" · nome do produto.
- Alternador **Vídeo · escaneamento | Fotos · IA**.
  - **Piloto: só a rota "Fotos · IA" funciona** (ver `PIPELINE-3D.md`). A aba de vídeo aparece com o selo "em breve" até existir um `ModelProvider` de fotogrametria.
- Área da câmera com anel de progresso e o alvo "Produto aqui · mantenha no centro"; cronômetro de gravação (rota de vídeo).
- Etapas: **1 · Altura dos olhos, 2 · De cima, 3 · De baixo**, com barra por etapa. Na rota de fotos, as etapas viram as poses das fotos (frente, 45°, lateral, de cima).
- Instrução da etapa + dicas "Luz suave · fundo liso · fora da vitrine".
- Botão de captura grande e redondo no rodapé.

### 04 · Visão geral (painel)
- **Sidebar escura** (`--color-ink`, 296px): nome do produto (Fraunces), seletor de loja (para o superadmin, que tem várias), navegação **Visão geral · Categorias · Produtos · Captura 3D · Traduções · QR Code · Configurações**, e "Conectado como" no rodapé. O item ativo fica em card claro. ("Categorias" não estava no mockup original — sem ela, uma loja nova (sem nenhuma categoria ainda) não tinha como chegar em `/categorias` pela UI; achado testando o `create-tenant` em staging, ver `docs/DECISOES.md`.)
- Cabeçalho: "Visão geral" + subtítulo; à direita, o filtro de período ("Últimos 7 dias") e o botão accent **"Marcar 'saiu do forno'"**.
- 4 KPIs: Acessos ao cardápio · Aberturas do 3D · Aberturas em AR · **Cliques no WhatsApp** (este em destaque, com fundo escuro).
- Tabela "Produtos mais vistos" (Viram em 3D / Abriram AR / WhatsApp) + barra empilhada "Idiomas usados".
- Coluna "Modelos 3D": status (Publicado / Processando / Sem captura → "Capturar agora"), rota e **custo**.

### 05 · Editar produto (painel)
- Breadcrumb "Produtos / Categoria", título, botões "Ver no cardápio" (contorno) e **"Salvar e publicar"** (accent).
- Card **Informações:** nome, categoria, preço, descrição, alergênicos (checkboxes em grade de 3 colunas), "Pode conter traços de…", e os interruptores **Esgotado hoje · Saiu do forno · Aceita encomenda**.
- Card **Modelo 3D:** preview, selo de status, rota e custo, tamanho do arquivo otimizado, compatibilidade de AR, e os botões "Refazer captura" / "Gerar por fotos (IA)".
- Card **Traduções:** abas PT/EN/ES, aviso "Traduzido automaticamente · revise antes de aprovar", campos no idioma e os botões **"Aprovar tradução"** / "Traduzir de novo".
