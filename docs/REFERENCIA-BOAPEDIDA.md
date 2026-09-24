# O que aproveitar do BoaPedida (só como referência)

Projeto: `C:\Users\felip\BoaPedida` (Django). **Não copiar código**; usar como inspiração.

| No BoaPedida | Vira no Cardápio 3D |
|---|---|
| `Categoria`, `Produto` (nome, descricao, preco, foto, ativo) | `categories`, `products` (textos traduzíveis, `priceCents`, `available`) |
| `GrupoOpcao` / `Opcao` (adicionais) | `variants` simples (tamanho/quantidade). Adicionais completos ficam para depois |
| `ConfiguracaoLoja.loja_aberta` | `tenant.openingHours` + "esgotado hoje" por produto |
| `templates/cardapio.html`, `js/Cardapio.js`, `css/cardapio.css` | Layout do cardápio mobile (abas de categoria, cards) |
| Carrinho, checkout, Pagar.me, entrega, chat, impressora | **Fora do escopo** do piloto |
