# Plano Pro Híbrido — 2 modelos de cobrança

## Objetivo
Permitir que a loja escolha entre dois modelos ao assinar o Plano Pro, com faturamento mensal automático via Asaas, tolerância de 5 dias e bloqueio/reativação automáticos.

## Modelos

**Modelo A — Fixo + por pedido**
- R$ 150/mês (mensalidade)
- + R$ 1,00 por pedido entregue no mês
- Sem comissão %

**Modelo B — Comissão sobre vendas**
- Sem mensalidade
- ~10% sobre cada pedido entregue
- Fatura mensal acumulada

Em ambos: taxa de serviço cobrada do cliente é do itChat.

## Mudanças no banco

1. `subscription_plans`: adicionar colunas
   - `billing_model` text ('fixed_plus_per_order' | 'commission')
   - `per_order_fee numeric` (default 0)
   - `commission_percent numeric` (default 0)
   - Seed: criar/atualizar planos `pro_fixed` (R$150 + R$1/pedido) e `pro_commission` (10%).

2. `store_subscriptions`: adicionar
   - `billing_model text`
   - `per_order_fee numeric default 0`
   - `commission_percent numeric default 0`
   - `grace_until timestamptz` (5 dias de tolerância pós-vencimento)

3. Nova tabela `monthly_invoices` (fatura mensal consolidada)
   - store_id, subscription_id, period_start, period_end
   - base_amount (mensalidade fixa), orders_count, per_order_total
   - commission_total, gross_sales, extras_total
   - total_amount, status (open/paid/overdue/cancelled)
   - asaas_payment_id, due_date, paid_at, raw jsonb
   - GRANT + RLS (dono lê; service_role escreve)

4. Função `generate_monthly_invoice(_store_id, _period)` SECURITY DEFINER
   - calcula pedidos `delivered` do mês
   - aplica modelo da assinatura
   - cria/atualiza `monthly_invoices`

5. Função `enforce_subscription_grace()` SECURITY DEFINER
   - varre `monthly_invoices` com `status='overdue'` e `due_date + 5d < now()`
   - atualiza `stores.lifecycle_status = 'blocked'`
   - reativa quando fatura quitada

## Edge functions

1. **`subscription-create`** (refatorar)
   - aceitar `billing_model: 'fixed_plus_per_order' | 'commission'`
   - Modelo A: cria Asaas subscription MONTHLY valor R$150 (cobrança fixa)
   - Modelo B: NÃO cria subscription recorrente — apenas cliente Asaas. Faturas serão criadas mensalmente como `payments` avulsos
   - persiste billing_model/per_order_fee/commission_percent em `store_subscriptions`

2. **`monthly-invoice-cron`** (nova, agendada dia 1)
   - para cada loja com sub ativa: chama `generate_monthly_invoice` para mês anterior
   - Modelo A: cria `payment` adicional no Asaas = (per_order_fee × pedidos) [a mensalidade já vem pela subscription]
   - Modelo B: cria `payment` no Asaas com total da comissão
   - vencimento +5 dias úteis; salva `asaas_payment_id` e `due_date`

3. **`subscription-grace-cron`** (nova, diária)
   - chama `enforce_subscription_grace()` → bloqueia/desbloqueia lojas

4. **`asaas-webhook`** (ajustar)
   - quando `PAYMENT_RECEIVED/CONFIRMED` de uma `monthly_invoice`: marca paga + reativa loja se estava bloqueada
   - quando `PAYMENT_OVERDUE`: marca overdue + seta `grace_until`

## Frontend

1. **`SubscriptionPaywall.tsx`** — nova tela de escolha:
   - Dois cards lado a lado (Modelo A / Modelo B) com bullets, exemplos, CTA "Escolher"
   - Após escolha → fluxo atual de CPF/CNPJ + método (PIX/Cartão) → chama `subscription-create` com `billing_model`

2. **`Admin` financeiro**: nova aba "Faturas" listando `monthly_invoices` com status e link de pagamento.

3. **`MasterSubscriptions`**: mostrar billing_model e total acumulado do mês corrente.

## Bloqueio de loja
- `Store.tsx` (página pública) e listagem do marketplace já filtram por `lifecycle_status`. Validar e adicionar filtro `!= 'blocked'` se faltar.

## Resumo técnico
- 1 migração (schema + função + seed planos)
- 3 edge functions (1 refatorada + 2 novas + ajuste no webhook)
- 2-3 arquivos de UI alterados
- Crons agendados via `pg_cron` ou chamada externa (instruirei a configurar)

Confirmo e começo pela migração?
