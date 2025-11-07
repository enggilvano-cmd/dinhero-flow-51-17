-- Função para conciliação bancária
CREATE OR REPLACE FUNCTION reconcile_transaction(
    p_transaction_id UUID,
    p_bank_reference TEXT,
    p_reconciliation_date TIMESTAMPTZ DEFAULT now()
) RETURNS void AS $$
BEGIN
    -- Atualiza a transação com as informações de conciliação
    UPDATE transactions
    SET 
        bank_reference = p_bank_reference,
        reconciliation_date = p_reconciliation_date,
        updated_at = now()
    WHERE id = p_transaction_id;
    
    -- Insere um registro de auditoria
    INSERT INTO audit_log (
        operation,
        table_name,
        record_id,
        old_values,
        new_values,
        user_id,
        ip_address
    )
    SELECT
        'RECONCILIATION',
        'transactions',
        p_transaction_id,
        NULL,
        json_build_object(
            'bank_reference', p_bank_reference,
            'reconciliation_date', p_reconciliation_date
        ),
        auth.uid(),
        current_setting('request.headers', true)::json->>'x-real-ip';
END;
$$ LANGUAGE plpgsql;

-- Função para verificar transações pendentes de conciliação
CREATE OR REPLACE FUNCTION get_unreconciled_transactions(
    p_account_id UUID,
    p_start_date TEXT,
    p_end_date TEXT
) RETURNS TABLE (
    id UUID,
    description TEXT,
    amount BIGINT,
    date TEXT,
    type TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.description,
        t.amount,
        t.date,
        t.type::TEXT,
        t.status::TEXT
    FROM transactions t
    WHERE t.account_id = p_account_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.reconciliation_date IS NULL
    ORDER BY t.date, t.created_at;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar relatório de conciliação
CREATE OR REPLACE FUNCTION generate_reconciliation_report(
    p_account_id UUID,
    p_start_date TEXT,
    p_end_date TEXT
) RETURNS TABLE (
    total_transactions BIGINT,
    total_reconciled BIGINT,
    total_unreconciled BIGINT,
    total_amount_reconciled BIGINT,
    total_amount_unreconciled BIGINT,
    account_balance BIGINT,
    last_reconciliation_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN reconciliation_date IS NOT NULL THEN 1 END) as total_reconciled,
            COUNT(CASE WHEN reconciliation_date IS NULL THEN 1 END) as total_unreconciled,
            COALESCE(SUM(CASE WHEN reconciliation_date IS NOT NULL THEN amount ELSE 0 END), 0) as total_amount_reconciled,
            COALESCE(SUM(CASE WHEN reconciliation_date IS NULL THEN amount ELSE 0 END), 0) as total_amount_unreconciled,
            MAX(reconciliation_date) as last_reconciliation_date
        FROM transactions
        WHERE account_id = p_account_id
        AND date BETWEEN p_start_date AND p_end_date
    )
    SELECT
        stats.total_transactions,
        stats.total_reconciled,
        stats.total_unreconciled,
        stats.total_amount_reconciled,
        stats.total_amount_unreconciled,
        a.balance as account_balance,
        stats.last_reconciliation_date
    FROM stats
    CROSS JOIN accounts a
    WHERE a.id = p_account_id;
END;
$$ LANGUAGE plpgsql;