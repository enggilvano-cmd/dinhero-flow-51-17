-- Melhorias no esquema de banco de dados

-- Adicionando campos para auditoria
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    ip_address TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Melhorias na tabela de transações
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS fiscal_document_type TEXT,
    ADD COLUMN IF NOT EXISTS fiscal_document_number TEXT,
    ADD COLUMN IF NOT EXISTS accrual_date DATE,
    ADD COLUMN IF NOT EXISTS bank_reference TEXT,
    ADD COLUMN IF NOT EXISTS reconciliation_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT[],
    ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_accrual ON transactions(accrual_date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- Função de auditoria
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log(
        operation,
        table_name,
        record_id,
        old_values,
        new_values,
        user_id,
        ip_address
    )
    VALUES (
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        COALESCE(NEW.user_id, OLD.user_id),
        current_setting('request.headers', true)::json->>'x-real-ip'
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers para auditoria
CREATE TRIGGER audit_transactions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_accounts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_categories_trigger
    AFTER INSERT OR UPDATE OR DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Função melhorada para atualização de saldo
CREATE OR REPLACE FUNCTION update_account_balance(p_account_id UUID)
RETURNS void AS $$
DECLARE
    v_balance BIGINT;
    v_account_type TEXT;
BEGIN
    -- Obtém o tipo da conta
    SELECT type INTO v_account_type
    FROM accounts
    WHERE id = p_account_id;

    -- Calcula o saldo baseado no tipo de conta
    IF v_account_type = 'credit' THEN
        -- Para cartões de crédito, considera apenas transações não pagas
        SELECT COALESCE(SUM(amount), 0) INTO v_balance
        FROM transactions
        WHERE account_id = p_account_id
        AND is_paid = false;
    ELSE
        -- Para outras contas, considera todas as transações confirmadas
        SELECT COALESCE(SUM(amount), 0) INTO v_balance
        FROM transactions
        WHERE account_id = p_account_id
        AND status = 'completed';
    END IF;

    -- Atualiza o saldo da conta
    UPDATE accounts
    SET 
        balance = v_balance,
        updated_at = now()
    WHERE id = p_account_id;

    -- Log de atualização bem-sucedida
    RAISE NOTICE 'Saldo atualizado com sucesso para a conta: %', p_account_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Erro ao atualizar saldo da conta %: %', p_account_id, SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- Função para validar transações
CREATE OR REPLACE FUNCTION validate_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Validação de valores negativos em transferências
    IF NEW.type = 'transfer' AND NEW.amount <= 0 THEN
        RAISE EXCEPTION 'Valor de transferência deve ser positivo';
    END IF;

    -- Validação de saldo suficiente
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.type IN ('expense', 'transfer') THEN
            IF NOT EXISTS (
                SELECT 1 FROM accounts a
                WHERE a.id = NEW.account_id
                AND a.type != 'credit'
                AND a.balance + CASE WHEN a.type = 'credit' THEN a.limit_amount ELSE 0 END >= ABS(NEW.amount)
            ) THEN
                RAISE EXCEPTION 'Saldo insuficiente para esta operação';
            END IF;
        END IF;
    END IF;

    -- Log de validação bem-sucedida
    RAISE NOTICE 'Transação validada com sucesso: %', NEW.id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Erro na validação da transação: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_transaction_trigger
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION validate_transaction();