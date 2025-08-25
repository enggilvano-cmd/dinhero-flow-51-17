// Supabase utilities for data persistence
import { supabase } from '@/integrations/supabase/client';

export interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  limit?: number; // For credit cards
  dueDate?: number; // Day of month for credit card due date
  closingDate?: number; // Day of month for credit card closing date
  color: string;
  createdAt: Date;
  userId: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date;
  type: "income" | "expense" | "transfer";
  categoryId: string;
  accountId: string;
  toAccountId?: string; // For transfers
  status: "pending" | "completed";
  installments?: number;
  currentInstallment?: number;
  parentTransactionId?: string; // For installment transactions
  isRecurring?: boolean;
  recurrenceType?: "daily" | "weekly" | "monthly" | "yearly";
  recurrenceEndDate?: Date;
  createdAt: Date;
  userId: string;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense" | "both";
  color: string;
  createdAt: Date;
  userId: string;
}

export interface AppSettings {
  currency: string;
  theme: "light" | "dark" | "system";
  notifications: boolean;
  autoBackup: boolean;
  language: string;
  userId: string;
}

// Account functions
export async function getAccounts(): Promise<Account[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(account => ({
      id: account.id,
      name: account.name,
      type: account.type as "checking" | "savings" | "credit" | "investment",
      balance: parseFloat(account.balance?.toString() || '0'),
      limit: account.limit_amount ? parseFloat(account.limit_amount.toString()) : undefined,
      dueDate: account.due_date || undefined,
      closingDate: account.closing_date || undefined,
      color: account.color,
      createdAt: new Date(account.created_at),
      userId: account.user_id
    }));
  } catch (error) {
    console.error('Error loading accounts:', error);
    return [];
  }
}

export async function saveAccount(account: Omit<Account, 'id' | 'createdAt' | 'userId'>): Promise<Account | null> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: user.user.id,
        name: account.name,
        type: account.type,
        balance: account.balance,
        limit_amount: account.limit,
        due_date: account.dueDate,
        closing_date: account.closingDate,
        color: account.color
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      balance: parseFloat(data.balance.toString()),
      limit: data.limit_amount ? parseFloat(data.limit_amount.toString()) : undefined,
      dueDate: data.due_date || undefined,
      closingDate: data.closing_date || undefined,
      color: data.color,
      createdAt: new Date(data.created_at),
      userId: data.user_id
    };
  } catch (error) {
    console.error('Error saving account:', error);
    return null;
  }
}

export async function updateAccount(id: string, updates: Partial<Omit<Account, 'id' | 'createdAt' | 'userId'>>): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.balance !== undefined) updateData.balance = updates.balance;
    if (updates.limit !== undefined) updateData.limit_amount = updates.limit;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    if (updates.closingDate !== undefined) updateData.closing_date = updates.closingDate;
    if (updates.color !== undefined) updateData.color = updates.color;

    const { error } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating account:', error);
    return false;
  }
}

export async function deleteAccount(id: string): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting account:', error);
    return false;
  }
}

// Transaction functions
export async function getTransactions(): Promise<Transaction[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        categories!inner(id, name)
      `)
      .eq('user_id', user.user.id)
      .order('date', { ascending: false });

    if (error) throw error;

    return (data || []).map(transaction => ({
      id: transaction.id,
      description: transaction.description,
      amount: parseFloat(transaction.amount.toString()),
      date: new Date(transaction.date),
      type: transaction.type as "income" | "expense" | "transfer",
      categoryId: transaction.category_id || '',
      accountId: transaction.account_id,
      toAccountId: transaction.to_account_id || undefined,
      status: transaction.status as "pending" | "completed",
      installments: transaction.installments || undefined,
      currentInstallment: transaction.current_installment || undefined,
      parentTransactionId: transaction.parent_transaction_id || undefined,
      isRecurring: transaction.is_recurring || false,
      recurrenceType: transaction.recurrence_type as "daily" | "weekly" | "monthly" | "yearly" | undefined,
      recurrenceEndDate: transaction.recurrence_end_date ? new Date(transaction.recurrence_end_date) : undefined,
      createdAt: new Date(transaction.created_at),
      userId: transaction.user_id
    }));
  } catch (error) {
    console.error('Error loading transactions:', error);
    return [];
  }
}

export async function saveTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'userId'>): Promise<Transaction | null> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.user.id,
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date.toISOString().split('T')[0],
        type: transaction.type,
        category_id: transaction.categoryId || null,
        account_id: transaction.accountId,
        to_account_id: transaction.toAccountId || null,
        status: transaction.status,
        installments: transaction.installments || null,
        current_installment: transaction.currentInstallment || null,
        parent_transaction_id: transaction.parentTransactionId || null,
        is_recurring: transaction.isRecurring || false,
        recurrence_type: transaction.recurrenceType || null,
        recurrence_end_date: transaction.recurrenceEndDate?.toISOString().split('T')[0] || null
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      description: data.description,
      amount: parseFloat(data.amount.toString()),
      date: new Date(data.date),
      type: data.type,
      categoryId: data.category_id || '',
      accountId: data.account_id,
      toAccountId: data.to_account_id || undefined,
      status: data.status,
      installments: data.installments || undefined,
      currentInstallment: data.current_installment || undefined,
      parentTransactionId: data.parent_transaction_id || undefined,
      isRecurring: data.is_recurring || false,
      recurrenceType: data.recurrence_type || undefined,
      recurrenceEndDate: data.recurrence_end_date ? new Date(data.recurrence_end_date) : undefined,
      createdAt: new Date(data.created_at),
      userId: data.user_id
    };
  } catch (error) {
    console.error('Error saving transaction:', error);
    return null;
  }
}

export async function updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt' | 'userId'>>): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const updateData: any = {};
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.date !== undefined) updateData.date = updates.date.toISOString().split('T')[0];
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId || null;
    if (updates.accountId !== undefined) updateData.account_id = updates.accountId;
    if (updates.toAccountId !== undefined) updateData.to_account_id = updates.toAccountId || null;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.installments !== undefined) updateData.installments = updates.installments || null;
    if (updates.currentInstallment !== undefined) updateData.current_installment = updates.currentInstallment || null;
    if (updates.parentTransactionId !== undefined) updateData.parent_transaction_id = updates.parentTransactionId || null;
    if (updates.isRecurring !== undefined) updateData.is_recurring = updates.isRecurring || false;
    if (updates.recurrenceType !== undefined) updateData.recurrence_type = updates.recurrenceType || null;
    if (updates.recurrenceEndDate !== undefined) updateData.recurrence_end_date = updates.recurrenceEndDate?.toISOString().split('T')[0] || null;

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating transaction:', error);
    return false;
  }
}

export async function deleteTransaction(id: string): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return false;
  }
}

// Category functions
export async function getCategories(): Promise<Category[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.user.id)
      .order('name', { ascending: true });

    if (error) throw error;

    // If no categories exist, initialize with defaults
    if (!data || data.length === 0) {
      await supabase.rpc('initialize_default_categories', { p_user_id: user.user.id });
      
      // Fetch the newly created categories
      const { data: newData, error: newError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.user.id)
        .order('name', { ascending: true });

      if (newError) throw newError;
      
      return (newData || []).map(category => ({
        id: category.id,
        name: category.name,
        type: category.type as "income" | "expense" | "both",
        color: category.color,
        createdAt: new Date(category.created_at),
        userId: category.user_id
      }));
    }

    return (data || []).map(category => ({
      id: category.id,
      name: category.name,
      type: category.type as "income" | "expense" | "both",
      color: category.color,
      createdAt: new Date(category.created_at),
      userId: category.user_id
    }));
  } catch (error) {
    console.error('Error loading categories:', error);
    return [];
  }
}

export async function saveCategory(category: Omit<Category, 'id' | 'createdAt' | 'userId'>): Promise<Category | null> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.user.id,
        name: category.name,
        type: category.type,
        color: category.color
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      color: data.color,
      createdAt: new Date(data.created_at),
      userId: data.user_id
    };
  } catch (error) {
    console.error('Error saving category:', error);
    return null;
  }
}

export async function updateCategory(id: string, updates: Partial<Omit<Category, 'id' | 'createdAt' | 'userId'>>): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.color !== undefined) updateData.color = updates.color;

    const { error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating category:', error);
    return false;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting category:', error);
    return false;
  }
}

// Settings functions
export async function getSettings(): Promise<AppSettings> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // If no settings exist, initialize with defaults
    if (!data) {
      await supabase.rpc('initialize_default_settings', { p_user_id: user.user.id });
      
      // Fetch the newly created settings
      const { data: newData, error: newError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.user.id)
        .single();

      if (newError) throw newError;
      
      return {
        currency: newData.currency,
        theme: newData.theme as "light" | "dark" | "system",
        notifications: newData.notifications,
        autoBackup: newData.auto_backup,
        language: newData.language,
        userId: newData.user_id
      };
    }

    return {
      currency: data.currency,
      theme: data.theme as "light" | "dark" | "system",
      notifications: data.notifications,
      autoBackup: data.auto_backup,
      language: data.language,
      userId: data.user_id
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    return {
      currency: 'BRL',
      theme: 'system',
      notifications: true,
      autoBackup: false,
      language: 'pt-BR',
      userId: ''
    };
  }
}

export async function updateSettings(settings: Omit<AppSettings, 'userId'>): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.user.id,
        currency: settings.currency,
        theme: settings.theme,
        notifications: settings.notifications,
        auto_backup: settings.autoBackup,
        language: settings.language
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

// Utility functions
export function generateId(): string {
  return crypto.randomUUID();
}

// Export/Import functions (for backward compatibility)
export async function exportData() {
  try {
    const [accounts, transactions, categories, settings] = await Promise.all([
      getAccounts(),
      getTransactions(),
      getCategories(),
      getSettings()
    ]);

    return {
      accounts,
      transactions,
      categories,
      settings,
      exportDate: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

export async function importData(data: any): Promise<{ success: boolean; message: string }> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    // Import accounts
    if (data.accounts && Array.isArray(data.accounts)) {
      for (const account of data.accounts) {
        await saveAccount({
          name: account.name,
          type: account.type,
          balance: account.balance,
          limit: account.limit,
          dueDate: account.dueDate,
          closingDate: account.closingDate,
          color: account.color
        });
      }
    }

    // Import categories
    if (data.categories && Array.isArray(data.categories)) {
      for (const category of data.categories) {
        await saveCategory({
          name: category.name,
          type: category.type,
          color: category.color
        });
      }
    }

    // Import transactions
    if (data.transactions && Array.isArray(data.transactions)) {
      for (const transaction of data.transactions) {
        await saveTransaction({
          description: transaction.description,
          amount: transaction.amount,
          date: new Date(transaction.date),
          type: transaction.type,
          categoryId: transaction.categoryId || transaction.category,
          accountId: transaction.accountId,
          toAccountId: transaction.toAccountId,
          status: transaction.status || 'completed',
          installments: transaction.installments,
          currentInstallment: transaction.currentInstallment,
          parentTransactionId: transaction.parentTransactionId,
          isRecurring: transaction.isRecurring,
          recurrenceType: transaction.recurrenceType,
          recurrenceEndDate: transaction.recurrenceEndDate ? new Date(transaction.recurrenceEndDate) : undefined
        });
      }
    }

    // Import settings
    if (data.settings) {
      await updateSettings({
        currency: data.settings.currency || 'BRL',
        theme: data.settings.theme || 'system',
        notifications: data.settings.notifications !== false,
        autoBackup: data.settings.autoBackup || false,
        language: data.settings.language || 'pt-BR'
      });
    }

    return { success: true, message: 'Dados importados com sucesso!' };
  } catch (error) {
    console.error('Error importing data:', error);
    return { success: false, message: 'Erro ao importar dados: ' + error };
  }
}