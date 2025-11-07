-- migration: 20250823000000_core_finance_logic.sql
--
-- OBJETIVO: Mover a lógica de negócios crítica do frontend para o banco de dados.
-- 1. Garante que os saldos das contas sejam atualizados atomicamente (via triggers).
-- 2. Cria uma tabela 'credit_bills' para persistir faturas.
-- 3. Adiciona funções para gerenciar faturas no servidor.
--

/***
 * ============================================================================
 * SEÇÃO 1: INTEGRIDADE DE SALDO (ACCOUNT BALANCE TRIGGERS)
 * Corrige a falha de "Race Condition" onde o saldo era calculado no frontend.
 * Os saldos agora são 100% gerenciados pelo banco de dados.
 * ============================================================================
 */

-- 1.1. Função de Trigger (O "Cérebro")
-- Esta função será chamada sempre que uma transação for INSERIDA, ATUALIZADA ou EXCLUÍDA.
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_amount DECIMAL(12, 2);
  v_type transaction_type;
BEGIN
  -- Determina qual conta e valor usar com base na operação (INSERT, DELETE, UPDATE)
  IF (TG_OP = 'DELETE') THEN
    -- Em um DELETE, revertemos a transação (ex: deletar despesa de -100 é +100)
    v_account_id := OLD.account_id;
    v_amount := -OLD.amount; -- Inverte o valor
    v_type := OLD.type;
  ELSIF (TG_OP = 'INSERT') THEN
    -- Em um INSERT, aplicamos a transação
    v_account_id := NEW.account_id;
    v_amount := NEW.amount;
    v_type := NEW.type;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Um UPDATE é um DELETE(OLD) + INSERT(NEW)
    -- 1. Reverte o valor antigo da conta antiga
    IF OLD.account_id = NEW.account_id THEN
      -- Conta não mudou, apenas ajusta a diferença
      UPDATE public.accounts
      SET balance = balance - OLD.amount + NEW.amount
      WHERE id = NEW.account_id;
    ELSE
      -- A transação mudou de conta
      -- Reverte da conta antiga
      UPDATE public.accounts
      SET balance = balance - OLD.amount
      WHERE id = OLD.account_id;
      
      -- Adiciona na conta nova
      UPDATE public.accounts
      SET balance = balance + NEW.amount
      WHERE id = NEW.account_id;
    END IF;

    -- Lida com a conta de destino (para transferências)
    IF OLD.to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.to_account_id;
    END IF;
    IF NEW.to_account_id IS NOT NULL THEN
      UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.to_account_id;
    END IF;
    
    RETURN NEW; -- O UPDATE já foi feito, então saímos
  END IF;

  -- Aplica a lógica para INSERT e DELETE
  
  -- Atualiza a conta principal (origem)
  UPDATE public.accounts
  SET balance = balance + v_amount
  WHERE id = v_account_id;

  -- Se for uma transferência, atualiza a conta de destino (invertido)
  IF v_type = 'transfer' AND (TG_OP = 'INSERT') THEN
    UPDATE public.accounts
    SET balance = balance - v_amount -- Oposto (se saiu -100 da origem, entra +100 no destino)
    WHERE id = NEW.to_account_id;
  ELSIF v_type = 'transfer' AND (TG_OP = 'DELETE') THEN
     UPDATE public.accounts
    SET balance = balance + v_amount -- Oposto (se deletou -100 da origem, deleta +100 do destino)
    WHERE id = OLD.to_account_id;
  END IF;

  -- Retorna a linha (NEW ou OLD) para o trigger
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 1.2. Triggers (Os "Ouvintes")
-- Remove triggers antigos se existirem (para idempotência)
DROP TRIGGER IF EXISTS on_transaction_insert ON public.transactions;
DROP TRIGGER IF EXISTS on_transaction_update ON public.transactions;
DROP TRIGGER IF EXISTS on_transaction_delete ON public.transactions;

-- Cria os novos triggers
CREATE TRIGGER on_transaction_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance();

CREATE TRIGGER on_transaction_update
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance();

CREATE TRIGGER on_transaction_delete
  AFTER DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance();


/***
 * ============================================================================
 * SEÇÃO 2: INTEGRIDADE DAS FATURAS (CREDIT BILLS)
 * Move a lógica de geração de faturas do frontend para o banco.
 * O frontend agora apenas LÊ faturas, em vez de CALCULÁ-LAS.
 * ============================================================================
 */

-- 2.1. Tabela de Faturas
-- Armazena o "documento" da fatura após seu fechamento.
CREATE TABLE IF NOT EXISTS public.credit_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'paid', 'partial'
  
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  start_date DATE NOT NULL, -- Data de início do período (dia seguinte ao fechamento anterior)
  closing_date DATE NOT NULL, -- Data de fechamento (data final do período)
  due_date DATE NOT NULL, -- Data de vencimento
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Garante uma fatura por conta por ciclo de fechamento
  UNIQUE(account_id, closing_date)
);

-- Habilita RLS
ALTER TABLE public.credit_bills ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own credit bills" ON public.credit_bills
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own credit bills" ON public.credit_bills
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own credit bills" ON public.credit_bills
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own credit bills" ON public.credit_bills
  FOR DELETE USING (auth.uid() = user_id);
  
CREATE INDEX idx_credit_bills_user_id ON public.credit_bills(user_id);
CREATE INDEX idx_credit_bills_account_id ON public.credit_bills(account_id);


-- 2.2. Função de Trigger (Ligar Transação à Fatura)
-- Quando uma transação de cartão de crédito é inserida, ela é ligada à fatura 'open'.
CREATE OR REPLACE FUNCTION public.link_transaction_to_bill()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_bill_amount DECIMAL(12, 2);
  v_account_type account_type;
BEGIN
  -- 1. Verifica se a conta é de crédito
  SELECT type INTO v_account_type FROM public.accounts WHERE id = NEW.account_id;
  
  -- Se não for 'expense' ou 'credit', ignora.
  IF NEW.type <> 'expense' OR v_account_type <> 'credit' THEN
    RETURN NEW;
  END IF;
  
  -- 2. Encontra a fatura 'open' para esta conta E data
  SELECT id, total_amount INTO v_bill_id, v_bill_amount
  FROM public.credit_bills
  WHERE account_id = NEW.account_id
    AND status = 'open'
    AND NEW.date >= start_date
    AND NEW.date <= closing_date;
    
  -- 3. Se a fatura existir, atualiza o total
  IF v_bill_id IS NOT NULL THEN
    UPDATE public.credit_bills
    SET total_amount = v_bill_amount + ABS(NEW.amount) -- Soma o valor (despesa é negativa)
    WHERE id = v_bill_id;
  ELSE
    -- Se não existir, é um problema (a fatura 'open' deveria ter sido criada)
    RAISE LOG 'No open bill found for account % on date %', NEW.account_id, NEW.date;
  END IF;

  RETURN NEW;
END;
$$;

-- 2.3. Trigger (para ligar transações)
DROP TRIGGER IF EXISTS on_transaction_insert_link_bill ON public.transactions;
CREATE TRIGGER on_transaction_insert_link_bill
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.link_transaction_to_bill();
  
-- 2.4. Função de Trigger (Desligar Transação da Fatura ao Deletar/Atualizar)
-- (Implementação simplificada: apenas remove o valor da fatura antiga ao atualizar/deletar)

CREATE OR REPLACE FUNCTION public.unlink_transaction_from_bill()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_bill_amount DECIMAL(12, 2);
  v_account_type account_type;
BEGIN
  -- 1. Verifica se a conta (antiga) é de crédito
  SELECT type INTO v_account_type FROM public.accounts WHERE id = OLD.account_id;
  
  IF OLD.type <> 'expense' OR v_account_type <> 'credit' THEN
    RETURN OLD;
  END IF;
  
  -- 2. Encontra a fatura (pela data antiga)
  SELECT id, total_amount INTO v_bill_id, v_bill_amount
  FROM public.credit_bills
  WHERE account_id = OLD.account_id
    AND OLD.date >= start_date
    AND OLD.date <= closing_date;
    
  -- 3. Se a fatura existir, SUBTRAI o valor
  IF v_bill_id IS NOT NULL THEN
    UPDATE public.credit_bills
    SET total_amount = v_bill_amount - ABS(OLD.amount)
    WHERE id = v_bill_id;
  END IF;

  RETURN OLD;
END;
$$;

-- 2.5. Triggers (Update/Delete)
DROP TRIGGER IF EXISTS on_transaction_delete_unlink_bill ON public.transactions;
CREATE TRIGGER on_transaction_delete_unlink_bill
  AFTER DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.unlink_transaction_from_bill();
  
DROP TRIGGER IF EXISTS on_transaction_update_relink_bill ON public.transactions;
CREATE TRIGGER on_transaction_update_relink_bill
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.unlink_transaction_from_bill(); -- Desliga da antiga
-- O trigger 'on_transaction_insert_link_bill' (combinado com o RLS do UPDATE) 
-- irá ligar o NEW.value na fatura correta.

-- 2.6. Função de Cron (Gerar e Fechar Faturas)
-- Esta função deve ser chamada diariamente por um Cron Job (ex: Supabase Cron)
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
  v_bill_id UUID;
BEGIN
  -- Itera sobre todas as contas de crédito ativas
  FOR credit_account IN
    SELECT id, closing_date, due_date, user_id
    FROM public.accounts
    WHERE type = 'credit'
    AND closing_date IS NOT NULL
    AND due_date IS NOT NULL
  LOOP
    -- 1. FECHAR FATURAS
    -- Encontra faturas 'open' cuja data de fechamento é hoje
    SELECT id INTO v_bill_id
    FROM public.credit_bills
    WHERE account_id = credit_account.id
      AND status = 'open'
      AND closing_date = v_today;
      
    IF v_bill_id IS NOT NULL THEN
      -- Fecha a fatura
      UPDATE public.credit_bills
      SET status = 'closed', updated_at = now()
      WHERE id = v_bill_id;
      
      RAISE LOG 'Closed bill % for account %', v_bill_id, credit_account.id;
    END IF;

    -- 2. CRIAR PRÓXIMAS FATURAS 'OPEN'
    -- Verifica se uma nova fatura 'open' precisa ser criada (após o fechamento da anterior)
    
    -- Calcula a data de fechamento do ciclo atual ou próximo
    v_closing_date := (date_trunc('month', v_today) + (credit_account.closing_date - 1 || ' days')::interval)::DATE;
    IF v_today > v_closing_date THEN
      -- Se já passamos do dia de fechamento deste mês, a próxima é no mês que vem
      v_closing_date := (v_closing_date + '1 month'::interval)::DATE;
    END IF;
    
    -- Calcula as outras datas com base no fechamento
    v_start_date := (v_closing_date - '1 month'::interval + '1 day'::interval)::DATE;
    v_due_date := (date_trunc('month', v_closing_date) + (credit_account.due_date - 1 || ' days')::interval)::DATE;
    
    IF credit_account.due_date <= credit_account.closing_date THEN
      -- Vencimento é no mês seguinte ao fechamento
      v_due_date := (v_due_date + '1 month'::interval)::DATE;
    END IF;

    -- Insere a nova fatura 'open' se ela ainda não existir
    INSERT INTO public.credit_bills
      (user_id, account_id, status, start_date, closing_date, due_date)
    VALUES
      (credit_account.user_id, credit_account.id, 'open', v_start_date, v_closing_date, v_due_date)
    ON CONFLICT (account_id, closing_date) DO NOTHING; -- Não faz nada se a fatura já existir

  END LOOP;
END;
$$;