import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Account, Category, Transaction } from '@/types';

interface AppContextType {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  loadingData: boolean;
  loadData: () => Promise<void>;
  addTransaction: (transaction: Partial<Transaction>) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (category: Partial<Category>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoadingData(true);

      // Load accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Load transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const addTransaction = async (transaction: Partial<Transaction>) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{ ...transaction, user_id: user?.id }])
        .select()
        .single();

      if (error) throw error;
      setTransactions(prev => [data, ...prev]);
      await loadData(); // Reload all data to update balances
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  };

  const updateTransaction = async (id: string, transaction: Partial<Transaction>) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update(transaction)
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      await loadData(); // Reload all data to update balances
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      await loadData(); // Reload all data to update balances
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  };

  const addCategory = async (category: Partial<Category>) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ ...category, user_id: user?.id }])
        .select()
        .single();

      if (error) throw error;
      setCategories(prev => [data, ...prev]);
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  };

  const updateCategory = async (id: string, category: Partial<Category>) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update(category)
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  };

  const value = {
    accounts,
    transactions,
    categories,
    loadingData,
    loadData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within a AppProvider');
  }
  return context;
}