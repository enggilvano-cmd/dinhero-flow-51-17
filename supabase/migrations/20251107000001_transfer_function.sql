-- Função para criar transferências
CREATE OR REPLACE FUNCTION create_transfer(
    p_from_account_id UUID,
    p_to_account_id UUID,
    p_amount BIGINT,
    p_date TEXT,
    p_description TEXT DEFAULT 'Transferência',
    p_tags TEXT[] DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_user_id UUID;
    v_transfer_id UUID;
BEGIN
    -- Obtém o ID do usuário atual
    v_user_id := auth.uid();
    
    -- Gera um ID único para vincular as duas transações
    v_transfer_id := gen_random_uuid();
    
    -- Insere a transação de saída (negativa)
    INSERT INTO transactions (
        user_id,
        account_id,
        description,
        amount,
        date,
        type,
        status,
        transfer_id,
        tags,
        is_paid
    ) VALUES (
        v_user_id,
        p_from_account_id,
        p_description,
        -p_amount,
        p_date,
        'transfer',
        'completed',
        v_transfer_id,
        p_tags,
        true
    );
    
    -- Insere a transação de entrada (positiva)
    INSERT INTO transactions (
        user_id,
        account_id,
        description,
        amount,
        date,
        type,
        status,
        transfer_id,
        tags,
        is_paid
    ) VALUES (
        v_user_id,
        p_to_account_id,
        p_description,
        p_amount,
        p_date,
        'transfer',
        'completed',
        v_transfer_id,
        p_tags,
        true
    );
    
    -- Atualiza os saldos das contas
    PERFORM update_account_balance(p_from_account_id);
    PERFORM update_account_balance(p_to_account_id);

    -- Log de sucesso
    RAISE NOTICE 'Transferência criada com sucesso: % -> %', p_from_account_id, p_to_account_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Erro ao criar transferência: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql;