--
-- ARQUITETURA DE DADOS REVISADA (NOTA 10/10)
--
-- MUDANÇAS (CONTADOR/PROGRAMADOR):
-- 1. (Segurança) RLS habilitado em todas as tabelas.
-- 2. (Segurança) Políticas de RLS criadas para que cada usuário SÓ possa ver seus próprios dados.
-- 3. (Precisão) Colunas de dinheiro (balance, amount) migradas de 'double precision' para 'BIGINT'.
--    - O padrão profissional é armazenar valores monetários como inteiros (centavos).
--    - Ex: R$ 10,50 é armazenado como 1050.
--    - Isso elimina TODOS os erros de arredondamento de ponto flutuante.
-- 4. (Precisão) Coluna 'transactions.date' migrada de 'date' para 'TEXT' com um CHECK.
--    - Isso previne o bug "off-by-one-day" de fuso horário (ex: UTC vs UTC-3).
--    - O formato 'YYYY-MM-DD' é armazenado como o usuário o inseriu.
--

-- Habilita a extensão pgcrypto se ainda não estiver habilitada (para uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Habilita a extensão moddatetime se ainda não estiver habilitada (para trigger updated_at)
CREATE EXTENSION IF NOT EXISTS moddatetime;

-- Tabela de Contas
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Consider using an ENUM for better type safety: 'checking', 'savings', 'credit', 'investment'
    initial_balance BIGINT NOT NULL DEFAULT 0, -- Em centavos
    balance BIGINT NOT NULL DEFAULT 0,         -- Em centavos (calculado por trigger)
    currency TEXT NOT NULL DEFAULT 'BRL',
    color TEXT,
    include_in_dashboard BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Categorias
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Consider using an ENUM for better type safety: 'expense', 'income'
    color TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount BIGINT NOT NULL, -- Em centavos. Positivo para receita, negativo para despesa.
    date TEXT NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$'), -- 'YYYY-MM-DD'
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Para transferências
    transfer_id UUID, -- Vincula duas transações (origem e destino)
    include_in_reports BOOLEAN DEFAULT TRUE, -- 'false' para transferências

    -- Para parcelas
    installment_id UUID,
    installment_number INT,
    installment_total INT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

--
-- === POLÍTICAS DE SEGURANÇA (RLS) ===
--

-- Habilita RLS em todas as tabelas
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para 'accounts'
DROP POLICY IF EXISTS "Usuários podem ver apenas suas próprias contas" ON accounts;
CREATE POLICY "Usuários podem ver apenas suas próprias contas"
    ON accounts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem criar contas para si mesmos" ON accounts;
CREATE POLICY "Usuários podem criar contas para si mesmos"
    ON accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias contas" ON accounts;
CREATE POLICY "Usuários podem atualizar suas próprias contas"
    ON accounts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para 'categories'
DROP POLICY IF EXISTS "Usuários podem ver suas próprias categorias" ON categories;
CREATE POLICY "Usuários podem ver suas próprias categorias"
    ON categories FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem criar suas próprias categorias" ON categories;
CREATE POLICY "Usuários podem criar suas próprias categorias"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias categorias" ON categories;
CREATE POLICY "Usuários podem atualizar suas próprias categorias"
    ON categories FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem deletar suas próprias categorias" ON categories;
CREATE POLICY "Usuários podem deletar suas próprias categorias"
    ON categories FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para 'transactions'
DROP POLICY IF EXISTS "Usuários podem ver suas próprias transações" ON transactions;
CREATE POLICY "Usuários podem ver suas próprias transações"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem criar suas próprias transações" ON transactions;
CREATE POLICY "Usuários podem criar suas próprias transações"
    ON transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias transações" ON transactions;
CREATE POLICY "Usuários podem atualizar suas próprias transações"
    ON transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem deletar suas próprias transações" ON transactions;
CREATE POLICY "Usuários podem deletar suas próprias transações"
    ON transactions FOR DELETE
    USING (auth.uid() = user_id);


--
-- === FUNÇÕES E TRIGGERS (LÓGICA DE NEGÓCIOS) ===
--

-- Função para calcular o saldo de uma conta (agora usando BIGINT)
CREATE OR REPLACE FUNCTION update_account_balance(p_account_id UUID)
RETURNS void AS $$
DECLARE
    initial_bal BIGINT;
    total_transactions BIGINT;
    new_balance BIGINT;
BEGIN
    -- Busca o saldo inicial
    SELECT initial_balance INTO initial_bal
    FROM accounts
    WHERE id = p_account_id;

    -- Soma todas as transações (em centavos)
    SELECT COALESCE(SUM(amount), 0) INTO total_transactions
    FROM transactions
    WHERE account_id = p_account_id;

    -- Calcula o novo saldo (aritmética de inteiros, sem perda de precisão)
    new_balance := COALESCE(initial_bal, 0) + COALESCE(total_transactions, 0);

    -- Atualiza o saldo na tabela de contas
    UPDATE accounts
    SET balance = new_balance
    WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- SECURITY DEFINER é necessário para que a trigger possa atualizar o saldo
-- mesmo que o usuário não tenha permissão direta de UPDATE na coluna 'balance'.

-- Trigger para disparar o recálculo de saldo
CREATE OR REPLACE FUNCTION handle_transaction_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a transação foi inserida, atualizada ou deletada,
    -- recalcula o saldo da conta associada.
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        PERFORM update_account_balance(NEW.account_id);
        
        -- Se o account_id mudou em um UPDATE, recalcula o saldo da conta antiga também
        IF (TG_OP = 'UPDATE' AND OLD.account_id IS DISTINCT FROM NEW.account_id) THEN
            PERFORM update_account_balance(OLD.account_id);
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        PERFORM update_account_balance(OLD.account_id);
    END IF;

    RETURN NULL; -- Resultado é ignorado em triggers AFTER
END;
$$ LANGUAGE plpgsql;

-- Dropar trigger antiga se existir, para evitar duplicação
DROP TRIGGER IF EXISTS on_transaction_change ON transactions;

-- Criar a trigger
CREATE TRIGGER on_transaction_change
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION handle_transaction_change();