# Adicionais reutilizáveis no catálogo

Hoje cada produto tem seus adicionais isolados (apenas nome + preço, presos a um único produto). Vou transformar em uma **biblioteca da loja** que serve para qualquer ramo (lanchonete, pizzaria, açaí, farmácia, pet, salão, mercado, etc).

## Como vai funcionar para o lojista

Nova aba **"Adicionais"** dentro do Catálogo, com duas seções:

1. **Itens adicionais** (a "biblioteca")
   - Cada item tem: foto, nome, descrição curta, preço, estoque (opcional, com controle on/off), ativo/inativo
   - Pode ser usado em vários grupos ao mesmo tempo (sem duplicar cadastro)
   - Exemplos por ramo: bacon/cheddar (lanche), borda recheada (pizza), granola/leite ninho (açaí), embalagem para presente (loja), escova/finalização (salão)

2. **Grupos de adicionais**
   - Nome do grupo (ex: "Escolha sua borda", "Complementos", "Adicionais")
   - Tipo: escolha única (radio) ou múltipla (checkbox)
   - Mínimo / Máximo de seleções, obrigatório sim/não
   - Lista de itens da biblioteca incluídos no grupo (com ordem arrastável)
   - Cada grupo pode ser **vinculado a vários produtos** de uma vez

Na tela do produto (editar), em vez de cadastrar adicionais do zero, o lojista só **marca quais grupos** quer usar — muito mais rápido quando há dezenas de produtos parecidos.

## O que muda para o cliente

A tela do produto continua igual: mostra os grupos e opções. Diferenças visuais:
- Quando o item tem foto, aparece miniatura ao lado do nome
- Itens sem estoque aparecem desabilitados ("Esgotado")
- O resto da experiência permanece idêntica (preço somado, observação, qtd)

## Mudanças técnicas

### Banco de dados (migração)

- `addon_items` (biblioteca por loja): `store_id`, `name`, `description`, `image_url`, `price`, `track_stock`, `stock`, `active`, `position`
- `addon_groups`: adicionar `store_id` (grupos passam a pertencer à loja, não a 1 produto) e deixar `product_id` como **legado/deprecated** (mantido para não quebrar dados existentes)
- `addon_group_items` (N:N grupo → item da biblioteca): `group_id`, `item_id`, `position`, `price_override` (opcional)
- `product_addon_groups` (N:N produto → grupo): `product_id`, `group_id`, `position`
- `addon_options` continua existindo para compatibilidade dos grupos antigos (leitura)
- Bucket de storage `product-images` já existe — reutilizo para fotos dos adicionais
- RLS: dono da loja gerencia, leitura pública (igual aos produtos)

### Migração de dados existentes
Para cada `addon_group` antigo: copio para o novo formato vinculando ao `store_id` do produto e criando os `addon_items` correspondentes a partir dos `addon_options`. Mantém tudo funcionando sem perda.

### Frontend

- Nova aba "Adicionais" em `MenuTab` (ou nova `AddonsTab` chamada por `MenuTab`)
- Componentes novos:
  - `AddonItemsLibrary` — CRUD dos itens (com upload de foto)
  - `AddonGroupsManager` — CRUD de grupos + selecionar itens da biblioteca
  - `AddonGroupsLinker` — usado dentro do `ProductFormModal` para marcar grupos do produto (substitui o `AddonGroupsEditor` atual para produtos novos; o antigo continua editável para produtos legados)
- `useStores.ts` ajustado para carregar adicionais via o novo modelo (grupos vinculados ao produto + itens da biblioteca)
- `ProductModal` / `Product.tsx` ganham foto miniatura e estado "esgotado" nas opções

### Compatibilidade
Produtos antigos seguem mostrando seus adicionais sem mudança. O lojista pode migrar manualmente quando quiser (botão "Mover para biblioteca" no grupo antigo).

## Entrega

1. Migração do banco (tabelas + RLS + grants + cópia dos dados)
2. UI da biblioteca de adicionais
3. UI de grupos + vínculo a produtos
4. Ajustes na tela do cliente (foto + esgotado)
5. Teste do fluxo ponta a ponta

Posso seguir?
