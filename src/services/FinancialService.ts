import { supabase } from '@/lib/supabase';
import { Account, Category } from '@/types';
import { Transaction, ReconciliationReport as DbReconciliationReport } from '@/types/supabase';
import { validateFiscalDocument } from '@/lib/taxReports';

export interface ReconciliationReport {
  totalTransactions: number;
  totalReconciled: number;
  totalUnreconciled: number;
  totalAmountReconciled: number;
  totalAmountUnreconciled: number;
  accountBalance: number;
  lastReconciliationDate: Date | null;
}

export class FinancialService {
  /**
   * Valida e registra uma nova transação com documento fiscal
   */
  static async createTransactionWithDocument(
    transaction: Omit<Transaction, 'id'> & {
      fiscal_document_type?: string;
      fiscal_document_number?: string;
    }
  ): Promise<void> {
    // Validação do documento fiscal
    if (transaction.fiscal_document_type && transaction.fiscal_document_number) {
      const isValid = validateFiscalDocument(
        transaction.fiscal_document_type,
        transaction.fiscal_document_number
      );
      if (!isValid) {
        throw new Error('Documento fiscal inválido');
      }
    }

    // Converte para o formato do banco de dados
    const dbTransaction = {
      description: transaction.description,
      amount: transaction.amount,
      date: typeof transaction.date === 'string' ? transaction.date : new Date(transaction.date).toISOString().split('T')[0],
      type: transaction.type,
      category_id: transaction.category_id,
      account_id: transaction.account_id,
      status: transaction.status || 'pending',
      is_paid: transaction.is_paid || false,
      fiscal_document_type: transaction.fiscal_document_type || null,
      fiscal_document_number: transaction.fiscal_document_number || null,
      user_id: transaction.user_id!,
      to_account_id: null,
      bank_reference: null,
      reconciliation_date: null,
      notes: null,
      tags: null,
      is_recurring: false,
      installment_id: null,
      installment_number: null,
      installment_total: null,
      parent_transaction_id: null
    } as const;

    const { error } = await supabase
      .from('transactions')
      .insert(dbTransaction as any);

    if (error) throw error;
  }

  /**
   * Concilia uma transação com informação bancária
   */
  static async reconcileTransaction(
    transactionId: string,
    bankReference: string
  ): Promise<void> {
    const params = {
      p_transaction_id: transactionId,
      p_bank_reference: bankReference
    };

    const { error } = await supabase.rpc('reconcile_transaction', params as any);
    if (error) throw error;
  }

  /**
   * Obtém transações não conciliadas de uma conta
   */
  static async getUnreconciledTransactions(
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{
      id: string;
      description: string;
      amount: number;
      date: string;
      type: string;
      status: string;
    }>> {
    const params = {
      p_account_id: accountId,
      p_start_date: startDate,
      p_end_date: endDate
    };

    const { data, error } = await supabase.rpc('get_unreconciled_transactions', params as any);
    if (error) throw error;
    return data || [];
  }

  /**
   * Gera relatório de conciliação
   */
  static async generateReconciliationReport(
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<ReconciliationReport> {
    const params = {
      p_account_id: accountId,
      p_start_date: startDate,
      p_end_date: endDate
    };

    const { data, error } = await supabase.rpc('generate_reconciliation_report', params as any);
    if (error) throw error;

    const report = data?.[0] as unknown as DbReconciliationReport;
    if (!report) {
      throw new Error('Não foi possível gerar o relatório');
    }

    return {
      totalTransactions: report.total_transactions,
      totalReconciled: report.total_reconciled,
      totalUnreconciled: report.total_unreconciled,
      totalAmountReconciled: report.total_amount_reconciled,
      totalAmountUnreconciled: report.total_amount_unreconciled,
      accountBalance: report.account_balance,
      lastReconciliationDate: report.last_reconciliation_date
        ? new Date(report.last_reconciliation_date)
        : null
    };
  }

  /**
   * Valida uma transferência entre contas
   */
  static validateTransfer(
    fromAccount: Account,
    amount: number
  ): void {
    if (amount <= 0) {
      throw new Error('O valor da transferência deve ser maior que zero');
    }

    const availableBalance = fromAccount.type === 'credit'
      ? (fromAccount.limit_amount || 0)
      : fromAccount.balance;

    if (amount > availableBalance) {
      throw new Error('Saldo insuficiente para realizar a transferência');
    }
  }

  /**
   * Processa uma transação recorrente
   */
  static async processRecurringTransaction(
    baseTransaction: Transaction,
    nextDate: Date
  ): Promise<void> {
    // Converte para o formato do banco de dados
    const dbTransaction = {
      description: baseTransaction.description,
      amount: baseTransaction.amount,
      date: nextDate.toISOString().split('T')[0],
      type: baseTransaction.type,
      category_id: baseTransaction.category_id,
      account_id: baseTransaction.account_id,
      status: baseTransaction.status,
      is_paid: baseTransaction.is_paid,
      user_id: baseTransaction.user_id!,
      to_account_id: baseTransaction.to_account_id || null,
      fiscal_document_type: baseTransaction.fiscal_document_type || null,
      fiscal_document_number: baseTransaction.fiscal_document_number || null,
      bank_reference: null,
      reconciliation_date: null,
      notes: baseTransaction.notes || null,
      tags: baseTransaction.tags || null,
      is_recurring: false,
      installment_id: baseTransaction.installment_id || null,
      installment_number: baseTransaction.installment_number || null,
      installment_total: baseTransaction.installment_total || null,
      parent_transaction_id: baseTransaction.id
    } as const;

    const { error } = await supabase
      .from('transactions')
      .insert(dbTransaction as any);

    if (error) throw error;
  }

  /**
   * Valida uma categoria antes de criar/atualizar
   */
  static validateCategory(category: Partial<Category>): void {
    if (!category.name || category.name.trim().length === 0) {
      throw new Error('Nome da categoria é obrigatório');
    }

    if (!category.type || !['income', 'expense', 'both'].includes(category.type)) {
      throw new Error('Tipo de categoria inválido');
    }
  }

  /**
   * Valida uma conta antes de criar/atualizar
   */
  static validateAccount(account: Partial<Account>): void {
    if (!account.name || account.name.trim().length === 0) {
      throw new Error('Nome da conta é obrigatório');
    }

    if (!account.type || !['checking', 'savings', 'credit', 'investment'].includes(account.type)) {
      throw new Error('Tipo de conta inválido');
    }

    if (account.type === 'credit') {
      if (!account.limit_amount || account.limit_amount <= 0) {
        throw new Error('Limite de crédito é obrigatório e deve ser maior que zero');
      }

      if (!account.due_date || account.due_date < 1 || account.due_date > 31) {
        throw new Error('Data de vencimento deve estar entre 1 e 31');
      }

      if (!account.closing_date || account.closing_date < 1 || account.closing_date > 31) {
        throw new Error('Data de fechamento deve estar entre 1 e 31');
      }
    }
  }
}