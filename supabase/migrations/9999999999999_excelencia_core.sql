-- migration: 9999999999999_excelencia_core.sql
--
-- OBJETIVO: Implementar melhorias de excelência para integridade,
-- robustez e escalabilidade.
--
-- 1. (Integridade) Altera 'update_account_balance' para que transações
--    'pending' NÃO afetem o saldo real da conta.
-- 2. (Robustez) Altera 'manage_credit_bills' (Cron) para ser idempotente
--    e resiliente a falhas (captura dias perdidos).
-- 3. (Escalabilidade) Cria a função RPC 'get_analytics_report' para mover
--    todo o processamento de relatórios do frontend para o backend.
-- 4. (Auditoria) Adiciona a coluna 'is_reconciled' para futuras
--    funcionalidades de conciliação bancária.
--

/***
 * ============================================================================
 * MELHORIA 1 (Integridade): Lógica de Saldo com Status 'pending'
 * Reescreve a função de trigger de saldo.
 * ============================================================================
 */

CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount DECIMAL(12, 2);
  v_old_amount DECIMAL(12, 2) := 0;
  v_new_amount DECIMAL(12, 2) := 0;
BEGIN
  -- Lógica para INSERT
  IF (TG_OP = 'INSERT') THEN
    -- SÓ afeta o saldo se a transação já nasce 'completed'
    IF NEW.status = 'completed' THEN
      v_new_amount := NEW.amount;
    END IF;

    -- Atualiza a conta de origem
    UPDATE public.accounts
    SET balance = balance + v_new_amount
    WHERE id = NEW.account_id;

    -- Atualiza a conta de destino (se for transferência)
    IF NEW.type = 'transfer' AND NEW.to_account_id IS NOT NULL THEN
      UPDATE public.accounts
      SET balance = balance - v_new_amount -- Oposto
      WHERE id = NEW.to_account_id;
    END IF;

  -- Lógica para DELETE
  ELSIF (TG_OP = 'DELETE') THEN
    -- SÓ reverte o saldo se a transação deletada estava 'completed'
    IF OLD.status = 'completed' THEN
      v_old_amount := -OLD.amount; -- Inverte o valor para reverter
    END IF;

    -- Reverte da conta de origem
    UPDATE public.accounts
    SET balance = balance + v_old_amount
    WHERE id = OLD.account_id;

    -- Reverte da conta de destino (se for transferência)
    IF OLD.type = 'transfer' AND OLD.to_account_id IS NOT NULL THEN
      UPDATE public.accounts
      SET balance = balance - v_old_amount -- Oposto
      WHERE id = OLD.to_account_id;
    END IF;

  -- Lógica para UPDATE
  ELSIF (TG_OP = 'UPDATE') THEN
    
    -- Determina o impacto do VALOR ANTIGO
    IF OLD.status = 'completed' THEN
      v_old_amount := -OLD.amount; -- Reverter o valor antigo
    END IF;

    -- Determina o impacto do VALOR NOVO
    IF NEW.status = 'completed' THEN
      v_new_amount := NEW.amount; -- Aplicar o valor novo
    END IF;

    -- Caso 1: A conta não mudou
    IF OLD.account_id = NEW.account_id THEN
      -- Aplica a diferença líquida (ex: -0 + 100, ou -50 + 100, ou -100 + 0)
      UPDATE public.accounts
      SET balance = balance + v_new_amount + v_old_amount -- v_old_amount é negativo
      WHERE id = NEW.account_id;
    
    -- Caso 2: A conta mudou
    ELSE
      -- Remove o impacto antigo da conta antiga
      UPDATE public.accounts
      SET balance = balance + v_old_amount
      WHERE id = OLD.account_id;
      
      -- Adiciona o impacto novo na conta nova
      UPDATE public.accounts
      SET balance = balance + v_new_amount
      WHERE id = NEW.account_id;
    END IF;

    -- Lida com contas de destino (transferências)
    -- (A lógica de 'status' também se aplica aqui)
    IF OLD.type = 'transfer' AND OLD.to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET balance = balance - v_old_amount WHERE id = OLD.to_account_id;
    END IF;
    IF NEW.type = 'transfer' AND NEW.to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET balance = balance - v_new_amount WHERE id = NEW.to_account_id;
    END IF;
    
  END IF;

  -- Retorna a linha (NEW ou OLD) para o trigger
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


/***
 * ============================================================================
 * MELHORIA 2 (Robustez): Cron Job Idempotente para Faturas
 * Reescreve a função 'manage_credit_bills'.
 * ============================================================================
 */

CREATE OR REPLACE FUNCTION public.manage_credit_bills()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  credit_account RECORD;
  v_today DATE := current_date;
  v_closing_date DATE;
  v_due_date DATE;
  v_start_date DATE;
BEGIN
  -- Itera sobre todas as contas de crédito ativas
  FOR credit_account IN
    SELECT id, closing_date, due_date, user_id
    FROM public.accounts
    WHERE type = 'credit'
    AND closing_date IS NOT NULL
    AND due_date IS NOT NULL
  LOOP
    -- 1. FECHAR FATURAS (Lógica Idempotente)
    -- Fecha TODAS as faturas 'open' cuja data de fechamento já passou.
    UPDATE public.credit_bills
    SET status = 'closed', updated_at = now()
    WHERE account_id = credit_account.id
      AND status = 'open'
      AND closing_date <= v_today; -- CORREÇÃO: Pega dias perdidos

    -- 2. CRIAR PRÓXIMAS FATURAS 'OPEN'
    -- A lógica de cálculo da *próxima* fatura já estava correta.
    v_closing_date := (date_trunc('month', v_today) + (credit_account.closing_date - 1 || ' days')::interval)::DATE;
    IF v_today > v_closing_date THEN
      -- Se já passamos do dia de fechamento deste mês, a próxima é no mês que vem
      v_closing_date := (v_closing_date + '1 month'::interval)::DATE;
    END IF;
    
    v_start_date := (v_closing_date - '1 month'::interval + '1 day'::interval)::DATE;
    v_due_date := (date_trunc('month', v_closing_date) + (credit_account.due_date - 1 || ' days')::interval)::DATE;
    
    IF credit_account.due_date <= credit_account.closing_date THEN
      v_due_date := (v_due_date + '1 month'::interval)::DATE;
    END IF;

    -- Tenta inserir a nova fatura 'open'.
    -- O 'ON CONFLICT' garante a idempotência.
    INSERT INTO public.credit_bills
      (user_id, account_id, status, start_date, closing_date, due_date)
    VALUES
      (credit_account.user_id, credit_account.id, 'open', v_start_date, v_closing_date, v_due_date)
    ON CONFLICT (account_id, closing_date) DO NOTHING; -- Não faz nada se a fatura já existir

  END LOOP;
END;
$$;


/***
 * ============================================================================
 * MELHORIA 3 (Escalabilidade): Função RPC para Relatórios de Análise
 * Nova função para processar relatórios no backend.
 * ============================================================================
 */

CREATE OR REPLACE FUNCTION public.get_analytics_report(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_totals_by_type JSON;
  v_category_data JSON;
  v_monthly_data JSON;
  v_result JSON;
BEGIN
  -- Tabela temporária para transações filtradas (cash flow)
  -- Exclui transferências E pagamentos de fatura (anti-dupla-contagem)
  CREATE TEMP TABLE temp_cash_flow_txs ON COMMIT DROP AS
  SELECT
    t.amount,
    t.type,
    t.category_id,
    t.date
  FROM public.transactions t
  LEFT JOIN public.categories c ON t.category_id = c.id
  WHERE t.user_id = p_user_id
    AND t.date >= p_start_date
    AND t.date <= p_end_date
    AND t.status = 'completed' -- Apenas transações completas
    AND t.type IN ('income', 'expense')
    AND t.to_account_id IS NULL -- Exclui transferências
    AND (c.name IS NULL OR c.name ILIKE 'Pagamento de Fatura') = false; -- Exclui pagamentos

  -- 1. Totais por Tipo (income, expenses)
  SELECT json_build_object(
    'income', COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    'expenses', COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0)
  )
  INTO v_totals_by_type
  FROM temp_cash_flow_txs;

  -- 2. Dados por Categoria (para gráfico de pizza)
  WITH category_totals AS (
    SELECT
      c.name AS category,
      COALESCE(c.color, '#8884d8') AS fill,
      ABS(SUM(t.amount)) AS amount,
      COUNT(t.*) AS transactions
    FROM temp_cash_flow_txs t
    JOIN public.categories c ON t.category_id = c.id
    WHERE t.type = 'expense' -- Padrão de despesas, pode ser parametrizado se necessário
    GROUP BY c.name, c.color
  ),
  total_expenses AS (
    SELECT SUM(amount) AS total FROM category_totals
  )
  SELECT json_agg(json_build_object(
      'category', ct.category,
      'amount', ct.amount,
      'transactions', ct.transactions,
      'fill', ct.fill,
      'percentage', (ct.amount / te.total) * 100
  ))
  INTO v_category_data
  FROM category_totals ct, total_expenses te;

  -- 3. Dados Mensais (para gráfico de evolução)
  WITH monthly_totals AS (
    SELECT
      date_trunc('month', date) AS month_start,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
      ABS(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) AS expenses
    FROM temp_cash_flow_txs
    GROUP BY 1
  ),
  ordered_months AS (
    SELECT
      to_char(month_start, 'YYYY-MM') AS month_key,
      to_char(month_start, 'Mon YYYY') AS month,
      income,
      expenses,
      (income - expenses) AS balance
    FROM monthly_totals
    ORDER BY month_start ASC
    LIMIT 12 -- Limita aos últimos 12 meses do período
  )
  SELECT json_agg(om.*)
  INTO v_monthly_data
  FROM ordered_months om;

  -- 4. Compila o resultado final
  SELECT json_build_object(
    'totals', v_totals_by_type,
    'categories', COALESCE(v_category_data, '[]'::json),
    'monthly', COALESCE(v_monthly_data, '[]'::json)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;


/***
 * ============================================================================
 * MELHORIA 4 (Auditoria): Preparação para Conciliação
 * Adiciona a coluna 'is_reconciled' na tabela de transações.
 * ============================================================================
 */

-- Adiciona a coluna, se ela ainda não existir
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN NOT NULL DEFAULT false;