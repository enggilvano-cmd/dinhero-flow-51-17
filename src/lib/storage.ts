// Local storage utilities for data persistence

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
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date;
  type: "income" | "expense" | "transfer";
  category: string;
  accountId: string;
  toAccountId?: string; // For transfers
  status: "pending" | "completed"; // New field for transaction status
  installments?: number;
  currentInstallment?: number;
  parentTransactionId?: string; // For installment transactions
  isRecurring?: boolean;
  recurrenceType?: "daily" | "weekly" | "monthly" | "yearly";
  recurrenceEndDate?: Date;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense" | "both";
  color: string;
  createdAt: Date;
}

export interface AppSettings {
  currency: string;
  theme: "light" | "dark" | "system";
  notifications: boolean;
  autoBackup: boolean;
  language: string;
}

const STORAGE_KEYS = {
  ACCOUNTS: 'planiflow_accounts',
  TRANSACTIONS: 'planiflow_transactions',
  SETTINGS: 'planiflow_settings',
  CATEGORIES: 'planiflow_categories'
} as const;

// Account storage functions
export function getAccounts(): Account[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!data) return [];
    
    const accounts = JSON.parse(data);
    return accounts.map((acc: any) => ({
      ...acc,
      createdAt: new Date(acc.createdAt),
      color: acc.color || "#6b7280" // Fallback color for existing accounts
    }));
  } catch (error) {
    console.error('Error loading accounts:', error);
    return [];
  }
}

export function saveAccounts(accounts: Account[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  } catch (error) {
    console.error('Error saving accounts:', error);
  }
}

// Transaction storage functions
export function getTransactions(): Transaction[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!data) return [];
    
    const transactions = JSON.parse(data);
    return transactions.map((trans: any) => ({
      ...trans,
      date: new Date(trans.date),
      createdAt: new Date(trans.createdAt),
      recurrenceEndDate: trans.recurrenceEndDate ? new Date(trans.recurrenceEndDate) : undefined,
      status: trans.status || "completed" // Default status for existing transactions
    }));
  } catch (error) {
    console.error('Error loading transactions:', error);
    return [];
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  } catch (error) {
    console.error('Error saving transactions:', error);
  }
}

// Settings storage functions
export function getSettings(): AppSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      return {
        currency: 'BRL',
        theme: 'system',
        notifications: true,
        autoBackup: false,
        language: 'pt-BR'
      };
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading settings:', error);
    return {
      currency: 'BRL', 
      theme: 'system',
      notifications: true,
      autoBackup: false,
      language: 'pt-BR'
    };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Utility functions
export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Category storage functions
export function getCategories(): Category[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!data) {
      // Initialize with default categories
      const defaultCategories: Category[] = [
        { id: generateId(), name: "Alimentação", type: "expense", color: "#ef4444", createdAt: new Date() },
        { id: generateId(), name: "Transporte", type: "expense", color: "#f97316", createdAt: new Date() },
        { id: generateId(), name: "Saúde", type: "expense", color: "#84cc16", createdAt: new Date() },
        { id: generateId(), name: "Educação", type: "expense", color: "#06b6d4", createdAt: new Date() },
        { id: generateId(), name: "Lazer", type: "expense", color: "#8b5cf6", createdAt: new Date() },
        { id: generateId(), name: "Moradia", type: "expense", color: "#ec4899", createdAt: new Date() },
        { id: generateId(), name: "Vestuário", type: "expense", color: "#10b981", createdAt: new Date() },
        { id: generateId(), name: "Tecnologia", type: "expense", color: "#3b82f6", createdAt: new Date() },
        { id: generateId(), name: "Investimentos", type: "both", color: "#6366f1", createdAt: new Date() },
        { id: generateId(), name: "Salário", type: "income", color: "#22c55e", createdAt: new Date() },
        { id: generateId(), name: "Freelance", type: "income", color: "#14b8a6", createdAt: new Date() },
        { id: generateId(), name: "Vendas", type: "income", color: "#f59e0b", createdAt: new Date() },
        { id: generateId(), name: "Outros", type: "both", color: "#6b7280", createdAt: new Date() }
      ];
      saveCategories(defaultCategories);
      return defaultCategories;
    }
    
    const categories = JSON.parse(data);
    return categories.map((cat: any) => ({
      ...cat,
      createdAt: new Date(cat.createdAt)
    }));
  } catch (error) {
    console.error('Error loading categories:', error);
    return [];
  }
}

export function saveCategories(categories: Category[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (error) {
    console.error('Error saving categories:', error);
  }
}

export function exportData() {
  return {
    accounts: getAccounts(),
    transactions: getTransactions(),
    categories: getCategories(),
    settings: getSettings(),
    exportDate: new Date().toISOString()
  };
}

export function importData(data: any): { success: boolean; message: string } {
  try {
    if (data.accounts) saveAccounts(data.accounts);
    if (data.transactions) saveTransactions(data.transactions);
    if (data.categories) saveCategories(data.categories);
    if (data.settings) saveSettings(data.settings);
    
    return { success: true, message: 'Dados importados com sucesso!' };
  } catch (error) {
    return { success: false, message: 'Erro ao importar dados: ' + error };
  }
}