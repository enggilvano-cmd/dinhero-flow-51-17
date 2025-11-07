export type Transaction = {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  description: string
  amount: number
  date: string
  type: 'income' | 'expense' | 'transfer'
  status: 'pending' | 'completed'
  is_paid: boolean
  to_account_id: string | null
  fiscal_document_type: string | null
  fiscal_document_number: string | null
  bank_reference: string | null
  reconciliation_date: string | null
  notes: string | null
  tags: string[] | null
  is_recurring: boolean
  installment_id: string | null
  installment_number: number | null
  installment_total: number | null
  parent_transaction_id: string | null
  created_at: string
  updated_at: string
}

export type ReconciliationReport = {
  total_transactions: number
  total_reconciled: number
  total_unreconciled: number
  total_amount_reconciled: number
  total_amount_unreconciled: number
  account_balance: number
  last_reconciliation_date: string | null
}

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'checking' | 'savings' | 'credit' | 'investment'
          balance: number
          limit_amount: number | null
          due_date: number | null
          closing_date: number | null
          color: string
          currency: string
          include_in_dashboard: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'income' | 'expense' | 'both'
          color: string
          icon: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string | null
          description: string
          amount: number
          date: string
          type: 'income' | 'expense' | 'transfer'
          status: 'pending' | 'completed'
          is_paid: boolean
          to_account_id: string | null
          fiscal_document_type: string | null
          fiscal_document_number: string | null
          bank_reference: string | null
          reconciliation_date: string | null
          notes: string | null
          tags: string[] | null
          is_recurring: boolean
          installment_id: string | null
          installment_number: number | null
          installment_total: number | null
          parent_transaction_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
      }
      audit_log: {
        Row: {
          id: string
          operation: string
          table_name: string
          record_id: string
          old_values: any
          new_values: any
          user_id: string
          ip_address: string | null
          timestamp: string
        }
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'timestamp'>
        Update: never // Não permite atualização de logs de auditoria
      }
    }
    Functions: {
      reconcile_transaction: {
        Args: {
          p_transaction_id: string
          p_bank_reference: string
          p_reconciliation_date?: string
        }
        Returns: null
      }
      get_unreconciled_transactions: {
        Args: {
          p_account_id: string
          p_start_date: string
          p_end_date: string
        }
        Returns: Array<{
          id: string
          description: string
          amount: number
          date: string
          type: string
          status: string
        }>
      }
      generate_reconciliation_report: {
        Args: {
          p_account_id: string
          p_start_date: string
          p_end_date: string
        }
        Returns: Array<{
          total_transactions: number
          total_reconciled: number
          total_unreconciled: number
          total_amount_reconciled: number
          total_amount_unreconciled: number
          account_balance: number
          last_reconciliation_date: string | null
        }>
      }
      create_transfer: {
        Args: {
          p_from_account_id: string
          p_to_account_id: string
          p_amount: number
          p_date: string
          p_description?: string
          p_tags?: string[]
        }
        Returns: null
      }
    }
  }
}