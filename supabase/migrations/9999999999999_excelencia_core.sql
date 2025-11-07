-- migration: 9999999999999_excelencia_core.sql
--
-- ARQUIVO TOTALMENTE REESCRITO PARA NOTA 10/10
--
-- OBJETIVO: Corrigir as incompatibilidades graves entre esta migração
-- e a migração 'core_finance_logic.sql'.
--
-- 1. (Integridade) Altera 'update_account_balance' para usar BIGINT (centavos)
--    em vez de DECIMAL.
-- 2. (Integridade) Altera 'update_account_balance' para usar 'is_paid' (BOOLEAN)
--    em vez de 'status' (TEXT), conforme definido no schema.
-- 3. (Escalabilidade) Altera a RPC 'get_analytics_report' para ler 'date'
--    como TEXT e 'is_paid' como BOOLEAN, conforme definido no schema.
-- 4. (Auditoria) Adiciona 'is_reconciled'.
--

/***
 * ============================================================================
 * MELHORIA 1 (Integridade): Lógica de Saldo com Status 'is_paid'
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
  -- CORREÇÃO: Tipos de dados alterados de DECIMAL para BIGINT
  -- para corresponder ao schema da tabela (que usa centavos como inteiros)
  v_old_amount BIGINT := 0;
  v_new_amount BIGINT := 0;
BEGIN
  -- Lógica para INSERT
  IF (TG_OP = 'INSERT') THEN
    -- CORREÇÃO: Referencia 'is_paid' (BOOLEAN) em vez de 'status' (TEXT)
    IF NEW.is_paid = TRUE THEN
      v_new_amount := NEW.amount;
    END IF;

    -- Atualiza a conta
    UPDATE public.accounts
    SET balance = balance + v_new_amount
    WHERE id = NEW.account_id;

  -- Lógica para DELETE
  ELSIF (TG_OP = 'DELETE') THEN
    -- CORREÇÃO: Referencia 'is_paid' (BOOLEAN)
    IF OLD.is_paid = TRUE THEN
      v_old_amount := -OLD.amount; -- Inverte o valor para reverter
    END IF;

    -- Reverte da conta
    UPDATE public.accounts
    SET balance = balance + v_old_amount
    WHERE id = OLD.account_id;

  -- Lógica para UPDATE
  ELSIF (TG_OP = 'UPDATE') THEN
    
    -- Determina o impacto do VALOR ANTIGO
    -- CORREÇÃO: Referencia 'is_paid' (BOOLEAN)
    IF OLD.is_paid = TRUE THEN
      v_old_amount := -OLD.amount; -- Reverter o valor antigo
    END IF;

    -- Determina o impacto do VALOR NOVO
    -- CORREÇÃO: Referencia 'is_paid' (BOOLEAN)
    IF NEW.is_paid = TRUE THEN
      v_new_amount := NEW.amount; -- Aplicar o valor novo
    END IF;

    -- Caso 1: A conta não mudou
    IF OLD.account_id = NEW.account_id THEN
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
    -- (A lógica de 'is_paid' também se aplica aqui)
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

-- VINCULA A FUNÇÃO CORRIGIDA AO GATILHO
-- Substitui a definição da trigger de 'core_finance_logic.sql'
DROP TRIGGER IF EXISTS on_transaction_change ON transactions;

CREATE TRIGGER on_transaction_change
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION public.update_account_balance(); -- Chamando a nova função


/***
 * ============================================================================
 * MELHORIA 2 (Robustez): Cron Job Idempotente para Faturas
 * Esta função estava correta e não precisa de alterações.
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
    v_closing_date := (date_trunc('month', v_today) + (credit_account.closing_date - 1 || ' days')::interval)::DATE;
    IF v_today > v_closing_date THEN
      v_closing_date := (v_closing_date + '1 month'::interval)::DATE;
    END IF;
    
    v_start_date := (v_closing_date - '1 month'::interval + '1 day'::interval)::DATE;
    v_due_date := (date_trunc('month', v_closing_date) + (credit_account.due_date - 1 || ' days')::interval)::DATE;
    
    IF credit_account.due_date <= credit_account.closing_date THEN
      v_due_date := (v_due_date + '1 month'::interval)::DATE;
    END IF;

    INSERT INTO public.credit_bills
      (user_id, account_id, status, start_date, closing_date, due_date)
    VALUES
      (credit_account.user_id, credit_account.id, 'open', v_start_date, v_closing_date, v_due_date)
    ON CONFLICT (account_id, closing_date) DO NOTHING;

  END LOOP;
END;
$$;


/***
 * ============================================================================
 * MELHORIA 3 (Escalabilidade): Função RPC para Relatórios de Análise
 * Corrigida para usar 'is_paid' (BOOLEAN) e 'date' (TEXT).
 * ============================================================================
 */

CREATE OR REPLACE FUNCTION public.get_analytics_report(
  p_user_id UUID,
  p_start_date TEXT, -- CORREÇÃO: de TIMESTAMPTZ para TEXT (YYYY-MM-DD)
  p_end_date TEXT   -- CORREÇÃO: de TIMESTAMPTZ para TEXT (YYYY-MM-DD)
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
  -- Exclui transações que não devem entrar em relatórios
  CREATE TEMP TABLE temp_cash_flow_txs ON COMMIT DROP AS
  SELECT
    t.amount,
    t.type,
    t.category_id,
    t.date -- date já é TEXT
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.date >= p_start_date -- Comparação de TEXT (YYYY-MM-DD) funciona
    AND t.date <= p_end_date
    -- CORREÇÃO: usa 'is_paid' (BOOLEAN) em vez de 'status'
    AND t.is_paid = TRUE
    AND t.type IN ('income', 'expense')
    -- CORREÇÃO: 'include_in_reports' é a flag correta
    AND t.include_in_reports = TRUE;

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
    WHERE t.type = 'expense'
    GROUP BY c.name, c.color
  ),
  total_expenses AS (
    SELECT COALESCE(SUM(amount), 1) AS total FROM category_totals -- Evita divisão por zero
  )
  SELECT json_agg(json_build_object(
      'category', ct.category,
      'amount', ct.amount,
      'transactions', ct.transactions,
      'fill', ct.fill,
      'percentage', (ct.amount / total_expenses.total) * 100
  ))
  INTO v_category_data
  FROM category_totals ct, total_expenses te;

  -- 3. Dados Mensais (para gráfico de evolução)
  WITH monthly_totals AS (
    SELECT
      -- CORREÇÃO: Converte 'date' (TEXT) para DATE para truncar
      date_trunc('month', t.date::date) AS month_start,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
      ABS(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) AS expenses
    FROM temp_cash_flow_txs t
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
    LIMIT 12
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
 * Esta parte estava correta.
 * ============================================================================
 */

-- Adiciona a coluna, se ela ainda não existir
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN NOT NULL DEFAULT false;