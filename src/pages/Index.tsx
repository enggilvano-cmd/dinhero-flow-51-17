import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/components/Dashboard";
import { AccountsPage } from "@/components/AccountsPage";
import { CreditBillsPage } from "@/components/CreditBillsPage";
import { TransactionsPage } from "@/components/TransactionsPage";
import { CategoriesPage } from "@/components/CategoriesPage";
import AnalyticsPage from "@/components/AnalyticsPage";
import SystemSettings from "@/components/SystemSettings";
import { SettingsPage } from "@/components/SettingsPage";
import { UserManagement } from "@/components/UserManagement";
import { UserProfile } from "@/components/UserProfile";
import { AddAccountModal } from "@/components/AddAccountModal";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { EditAccountModal } from "@/components/EditAccountModal";
import { EditTransactionModal } from "@/components/EditTransactionModal";
import { InstallmentEditScopeDialog, EditScope } from "@/components/InstallmentEditScopeDialog";
import { TransferModal } from "@/components/TransferModal";
import { CreditPaymentModal } from "@/components/CreditPaymentModal";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MigrationWarning } from "@/components/MigrationWarning";
import { createDateFromString } from "@/lib/dateUtils";

const PlaniFlowApp = () => {
  const { settings, updateSettings } = useSettings();
  const { user, loading, isAdmin } = useAuth();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Modal states
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [addTransactionModalOpen, setAddTransactionModalOpen] = useState(false);
  const [editAccountModalOpen, setEditAccountModalOpen] = useState(false);
  const [editTransactionModalOpen, setEditTransactionModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [creditPaymentModalOpen, setCreditPaymentModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [payingCreditAccount, setPayingCreditAccount] = useState<any | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [transactionFilterType, setTransactionFilterType] = useState<"income" | "expense" | "transfer" | "all">("all");
  const [transactionFilterStatus, setTransactionFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [transactionDateFilter, setTransactionDateFilter] = useState<"all" | "current_month" | "custom" | "month_picker">("all");
  const [transactionFilterAccountType, setTransactionFilterAccountType] = useState<"all" | "checking" | "savings" | "credit">("all");
  const [accountFilterType, setAccountFilterType] = useState<"all" | "checking" | "savings" | "credit">("all");
  
  // Date parameters for transaction navigation - Reset when switching pages
  const [transactionSelectedMonth, setTransactionSelectedMonth] = useState<Date | undefined>(undefined);
  const [transactionCustomStartDate, setTransactionCustomStartDate] = useState<Date | undefined>(undefined);
  const [transactionCustomEndDate, setTransactionCustomEndDate] = useState<Date | undefined>(undefined);

  // Reset transaction filters when switching to transactions page
  const resetTransactionFilters = () => {
    setTransactionSelectedMonth(undefined);
    setTransactionCustomStartDate(undefined);
    setTransactionCustomEndDate(undefined);
  };

  // Load data from Supabase
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      try {
        setLoadingData(true);
        console.log('Loading accounts and transactions from Supabase...');
        
        // Load accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (accountsError) {
          console.error('Error loading accounts:', accountsError);
        } else {
          const mappedAccounts = accountsData || [];
          
          // Mapear os dados do Supabase para o formato esperado pelos componentes
          const formattedAccounts = mappedAccounts.map(acc => ({
            ...acc,
            // Mapear campos do Supabase para o formato esperado
            limit: acc.limit_amount,
            dueDate: acc.due_date,
            closingDate: acc.closing_date
          }));
          
          console.log('Loaded accounts:', formattedAccounts.length);
          setAccounts(formattedAccounts);
        }

        // Load categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id);

        if (categoriesError) {
          console.error('Error loading categories:', categoriesError);
        } else {
          console.log('Loaded categories:', categoriesData?.length);
          setCategories(categoriesData || []);
        }

        // Load transactions
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (transactionsError) {
          console.error('Error loading transactions:', transactionsError);
        } else {
          const mappedTransactions = transactionsData || [];
          
          // Mapear os dados do Supabase para o formato esperado pelos componentes
          const formattedTransactions = mappedTransactions.map(trans => ({
            ...trans,
            // Mapear campos do Supabase para o formato esperado
            accountId: trans.account_id,
            category: trans.category_id,
            currentInstallment: trans.current_installment,
            parentTransactionId: trans.parent_transaction_id,
            toAccountId: trans.to_account_id,
            // Garantir que date seja Date object usando createDateFromString para evitar problemas de fuso horário
            date: createDateFromString(trans.date)
          }));
          
          console.log('Loaded transactions:', formattedTransactions.length);
          setTransactions(formattedTransactions);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [user]);

  // Helper function to generate UUID
  const generateId = () => crypto.randomUUID();

  const handleAddAccount = async (accountData: any) => {
    if (!user) return;
    
    try {
      // Map incoming data (supports camelCase from UI and snake_case) to snake_case for Supabase
      const limitValue = accountData.limit ?? accountData.limit_amount;
      const dueDateValue = accountData.dueDate ?? accountData.due_date;
      const closingDateValue = accountData.closingDate ?? accountData.closing_date;

      const mappedData = {
        name: accountData.name,
        type: accountData.type,
        balance: accountData.balance,
        color: accountData.color,
        user_id: user.id,
        ...(limitValue !== undefined && { limit_amount: limitValue }),
        ...(dueDateValue !== undefined && { due_date: dueDateValue }),
        ...(closingDateValue !== undefined && { closing_date: closingDateValue })
      };

      const { data, error } = await supabase
        .from('accounts')
        .insert([mappedData])
        .select()
        .single();

      if (error) {
        console.error('Error adding account:', error);
        return;
      }

      setAccounts(prev => [...prev, data]);
    } catch (error) {
      console.error('Error adding account:', error);
    }
  };

  const handleEditAccount = async (updatedAccount: any) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('accounts')
        .update(updatedAccount)
        .eq('id', updatedAccount.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating account:', error);
        return;
      }

      setAccounts(prev => prev.map(acc => 
        acc.id === updatedAccount.id ? { ...acc, ...updatedAccount } : acc
      ));
      setEditingAccount(null);
    } catch (error) {
      console.error('Error updating account:', error);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting account:', error);
        return;
      }

      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
      setTransactions(prev => prev.filter(trans => trans.account_id !== accountId));
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  const handleAddTransaction = async (transactionData: any) => {
    if (!user) return;
    
    try {
      // Map camelCase properties to snake_case for Supabase
      const mappedData = {
        description: transactionData.description,
        amount: transactionData.amount,
        date: transactionData.date.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        type: transactionData.type,
        account_id: transactionData.accountId,
        category_id: transactionData.category,
        status: transactionData.status,
        user_id: user.id
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert([mappedData])
        .select()
        .single();

      if (error) {
        console.error('Error adding transaction:', error);
        return;
      }

      setTransactions(prev => [...prev, data]);

      // Update account balance
      const balanceChange = transactionData.type === "income" 
        ? transactionData.amount 
        : -transactionData.amount;
      
      // Get current account balance and validate transaction
      const account = accounts.find(acc => acc.id === transactionData.accountId);
      if (account) {
        const newBalance = account.balance + balanceChange;
        
        // Check if transaction would exceed limit for checking accounts
        if (account.type === "checking" && newBalance < 0 && account.limit_amount) {
          if (Math.abs(newBalance) > account.limit_amount) {
            throw new Error(`Transação excede o limite de ${account.limit_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
          }
        }
        
        await supabase
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', transactionData.accountId)
          .eq('user_id', user.id);
      }

      // Update local state
      setAccounts(prev => prev.map(account => {
        if (account.id === transactionData.accountId) {
          return { ...account, balance: account.balance + balanceChange };
        }
        return account;
      }));
    } catch (error) {
      console.error('Error adding transaction:', error);
      if (error instanceof Error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleAddInstallmentTransactions = async (transactionsData: any[]) => {
    if (!user) return;
    
    try {
      console.log('Processing installment transactions:', transactionsData);
      
      const transactionsToInsert = transactionsData.map(data => ({
        description: data.description,
        amount: data.amount,
        date: data.date.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        type: data.type,
        account_id: data.accountId,
        category_id: data.category,
        status: data.status,
        installments: data.installments,
        current_installment: data.currentInstallment,
        parent_transaction_id: data.parentTransactionId, // This will be null now
        user_id: user.id
      }));

      console.log('Inserting transactions to database:', transactionsToInsert);

      const { data: newTransactions, error } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select();

      if (error) {
        console.error('Database error adding installment transactions:', error);
        throw error;
      }

      console.log('Successfully created transactions:', newTransactions);
      setTransactions(prev => [...prev, ...newTransactions]);

      // Update account balance for all installments
      const totalAmount = transactionsData.reduce((sum, trans) => {
        return sum + (trans.type === "income" ? trans.amount : -trans.amount);
      }, 0);

      const accountId = transactionsData[0].accountId;
      const account = accounts.find(acc => acc.id === accountId);
      if (account) {
        const newBalance = account.balance + totalAmount;
        await supabase
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', accountId)
          .eq('user_id', user.id);

        setAccounts(prev => prev.map(account => {
          if (account.id === accountId) {
            return { ...account, balance: newBalance };
          }
          return account;
        }));
      }
    } catch (error) {
      console.error('Error adding installment transactions:', error);
      throw error; // Re-throw to be caught by the modal
    }
  };

  const handleImportTransactions = async (transactionsData: any[]) => {
    if (!user) return;
    
    try {
      console.log('Import data received:', transactionsData);

      // Map category names to IDs
      const transactionsToInsert = await Promise.all(transactionsData.map(async (data) => {
        let category_id = null;
        
        if (data.category) {
          // Find existing category by name
          const { data: existingCategory } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', data.category)
            .maybeSingle();
          
          if (existingCategory) {
            category_id = existingCategory.id;
          } else {
            // Create new category if it doesn't exist
            const { data: newCategory } = await supabase
              .from('categories')
              .insert({
                name: data.category,
                user_id: user.id,
                type: data.type === 'income' ? 'income' : 'expense'
              })
              .select('id')
              .single();
            
            if (newCategory) {
              category_id = newCategory.id;
            }
          }
        }

        return {
          description: data.description,
          amount: data.amount,
          category_id,
          type: data.type,
          account_id: data.account_id,
          date: data.date,
          status: data.status,
          installments: data.installments,
          current_installment: data.current_installment,
          user_id: user.id
        };
      }));

      console.log('Transactions to insert:', transactionsToInsert);

      const { data: newTransactions, error } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select();

      if (error) {
        console.error('Error importing transactions:', error);
        toast({
          title: "Erro na importação",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      console.log('Transactions imported successfully:', newTransactions);
      setTransactions(prev => [...prev, ...newTransactions]);

      // Update account balances for all imported transactions
      const accountBalanceChanges = transactionsData.reduce((acc, trans) => {
        const balanceChange = trans.type === "income" ? trans.amount : -trans.amount;
        acc[trans.account_id] = (acc[trans.account_id] || 0) + balanceChange;
        return acc;
      }, {} as Record<string, number>);

      // Update balances in database and local state
      for (const [accountId, balanceChange] of Object.entries(accountBalanceChanges)) {
        const account = accounts.find(acc => acc.id === accountId);
        if (account && balanceChange) {
          const newBalance = account.balance + balanceChange;
          await supabase
            .from('accounts')
            .update({ balance: newBalance })
            .eq('id', accountId)
            .eq('user_id', user.id);
        }
      }

      setAccounts(prev => prev.map(account => {
        const balanceChange = accountBalanceChanges[account.id];
        if (balanceChange !== undefined) {
          return { ...account, balance: account.balance + balanceChange };
        }
        return account;
      }));

      toast({
        title: "Importação concluída",
        description: `${newTransactions.length} transações importadas com sucesso`,
      });

    } catch (error) {
      console.error('Error importing transactions:', error);
      toast({
        title: "Erro na importação",
        description: "Erro inesperado durante a importação",
        variant: "destructive"
      });
    }
  };

  const handleTransfer = async (fromAccountId: string, toAccountId: string, amount: number, date: Date) => {
    if (!user) return;
    
    try {
      const fromAccount = accounts.find(acc => acc.id === fromAccountId);
      const toAccount = accounts.find(acc => acc.id === toAccountId);
      
      if (!fromAccount || !toAccount) return;

      // Update account balances
      const newFromBalance = fromAccount.balance - amount;
      const newToBalance = toAccount.balance + amount;

      // Check if transfer would exceed limit for checking accounts
      if (fromAccount.type === "checking" && newFromBalance < 0 && fromAccount.limit_amount) {
        if (Math.abs(newFromBalance) > fromAccount.limit_amount) {
          throw new Error(`Transferência excede o limite da conta ${fromAccount.name} de ${fromAccount.limit_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
        }
      }

      // Create two separate transactions for the transfer
      const outgoingTransaction = {
        description: `Transferência para ${toAccount.name}`,
        amount,
        date: date.toISOString().split('T')[0],
        type: "expense" as const,
        category_id: null,
        account_id: fromAccountId,
        to_account_id: toAccountId, // Keep reference for transfer relationship
        status: "completed" as const,
        user_id: user.id
      };

      const incomingTransaction = {
        description: `Transferência de ${fromAccount.name}`,
        amount,
        date: date.toISOString().split('T')[0],
        type: "income" as const,
        category_id: null,
        account_id: toAccountId,
        to_account_id: fromAccountId, // Keep reference for transfer relationship
        status: "completed" as const,
        user_id: user.id
      };

      const { data: newTransactions, error } = await supabase
        .from('transactions')
        .insert([outgoingTransaction, incomingTransaction])
        .select();

      if (error) {
        console.error('Error creating transfer:', error);
        return;
      }

      const allNewTransactions = newTransactions || [];

      setTransactions(prev => [...prev, ...allNewTransactions]);

      await Promise.all([
        supabase
          .from('accounts')
          .update({ balance: newFromBalance })
          .eq('id', fromAccountId)
          .eq('user_id', user.id),
        supabase
          .from('accounts')
          .update({ balance: newToBalance })
          .eq('id', toAccountId)
          .eq('user_id', user.id)
      ]);

      setAccounts(prev => prev.map(account => {
        if (account.id === fromAccountId) {
          return { ...account, balance: newFromBalance };
        }
        if (account.id === toAccountId) {
          return { ...account, balance: newToBalance };
        }
        return account;
      }));
    } catch (error) {
      console.error('Error processing transfer:', error);
      if (error instanceof Error) {
        toast({
          title: "Erro na transferência",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleEditTransaction = async (updatedTransaction: any, editScope?: EditScope) => {
    if (!user) return;
    
    try {
      const oldTransaction = transactions.find(t => t.id === updatedTransaction.id);
      if (!oldTransaction) return;

      // For single transactions or current-only edits
      if (!editScope || editScope === "current" || !updatedTransaction.installments) {
        const cleanTransaction = {
          description: updatedTransaction.description,
          amount: updatedTransaction.amount,
          date: typeof updatedTransaction.date === 'string' ? 
            updatedTransaction.date : 
            updatedTransaction.date.toISOString().split('T')[0],
          type: updatedTransaction.type,
          category_id: updatedTransaction.category_id,
          account_id: updatedTransaction.account_id,
          status: updatedTransaction.status || 'completed'
        };

        const { error } = await supabase
          .from('transactions')
          .update(cleanTransaction)
          .eq('id', updatedTransaction.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating transaction:', error);
          return;
        }

        // Calculate balance changes
        const oldBalanceChange = oldTransaction.type === "income" 
          ? -oldTransaction.amount 
          : oldTransaction.amount;
        
        const newBalanceChange = updatedTransaction.type === "income" 
          ? updatedTransaction.amount 
          : -updatedTransaction.amount;

        // Update account balance
        if (oldTransaction.account_id === updatedTransaction.account_id) {
          const account = accounts.find(acc => acc.id === oldTransaction.account_id);
          if (account) {
            const newBalance = account.balance + oldBalanceChange + newBalanceChange;
            
            await supabase
              .from('accounts')
              .update({ balance: newBalance })
              .eq('id', oldTransaction.account_id)
              .eq('user_id', user.id);

            setAccounts(prev => prev.map(account => {
              if (account.id === oldTransaction.account_id) {
                return { ...account, balance: newBalance };
              }
              return account;
            }));
          }
        }

        setTransactions(prev => prev.map(trans => 
          trans.id === updatedTransaction.id ? { ...trans, ...updatedTransaction } : trans
        ));
        setEditingTransaction(null);
        return;
      }

      // Handle installment edits with scope - reload data after update
      await handleInstallmentScopeEdit(updatedTransaction, editScope, oldTransaction);
      
    } catch (error) {
      console.error('Error updating transaction:', error);
      if (error instanceof Error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleInstallmentScopeEdit = async (updatedTransaction: any, editScope: EditScope, oldTransaction: any) => {
    // Build update data
    const cleanTransactionData = {
      description: updatedTransaction.description,
      amount: updatedTransaction.amount,
      type: updatedTransaction.type,
      category_id: updatedTransaction.category_id,
      account_id: updatedTransaction.account_id,
      status: updatedTransaction.status
    };

    // Get base description (without installment info)
    const baseDescription = oldTransaction.description.split(' (')[0];
    
    // Build query conditions based on scope
    let queryBuilder = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .eq('installments', oldTransaction.installments)
      .like('description', `${baseDescription}%`);

    if (editScope === "current-and-previous") {
      queryBuilder = queryBuilder.lte('current_installment', oldTransaction.current_installment);
    } else if (editScope === "current-and-remaining") {
      queryBuilder = queryBuilder.gte('current_installment', oldTransaction.current_installment);
    }
    // For "all", no additional filter needed

    const { data: targetTransactions, error: selectError } = await queryBuilder;
    
    if (selectError) throw selectError;

    // Update each transaction maintaining installment numbering
    for (const transaction of targetTransactions || []) {
      const updatedData = {
        ...cleanTransactionData,
        description: `${cleanTransactionData.description} (${transaction.current_installment}/${transaction.installments})`
      };

      const { error: updateError } = await supabase
        .from('transactions')
        .update(updatedData)
        .eq('id', transaction.id)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;
    }

    // Calculate and apply balance changes
    const balanceChangePerTransaction = updatedTransaction.amount - oldTransaction.amount;
    const multiplier = updatedTransaction.type === "income" ? 1 : -1;
    const totalBalanceChange = balanceChangePerTransaction * multiplier * (targetTransactions?.length || 0);

    if (totalBalanceChange !== 0) {
      const account = accounts.find(acc => acc.id === updatedTransaction.account_id);
      if (account) {
        const newBalance = account.balance + totalBalanceChange;
        
        await supabase
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', updatedTransaction.account_id)
          .eq('user_id', user?.id);

        setAccounts(prev => prev.map(acc => 
          acc.id === updatedTransaction.account_id ? { ...acc, balance: newBalance } : acc
        ));
      }
    }

    // Reload transactions data to show updates
    const { data: refreshedTransactions, error: refreshError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (!refreshError && refreshedTransactions) {
      const formattedTransactions = refreshedTransactions.map(trans => ({
        ...trans,
        accountId: trans.account_id,
        category: trans.category_id,
        currentInstallment: trans.current_installment,
        parentTransactionId: trans.parent_transaction_id,
        toAccountId: trans.to_account_id,
        date: createDateFromString(trans.date)
      }));
      setTransactions(formattedTransactions);
    }
    
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;
    
    try {
      const transactionToDelete = transactions.find(trans => trans.id === transactionId);
      if (!transactionToDelete) return;

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting transaction:', error);
        return;
      }

      // Update account balance by reverting the transaction effect
      const account = accounts.find(acc => acc.id === transactionToDelete.account_id);
      if (account) {
        const balanceChange = transactionToDelete.type === "income" 
          ? -transactionToDelete.amount  // Revert income (subtract)
          : transactionToDelete.amount;  // Revert expense (add back)
        
        const newBalance = account.balance + balanceChange;
        await supabase
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', transactionToDelete.account_id)
          .eq('user_id', user.id);

        setAccounts(prev => prev.map(account => {
          if (account.id === transactionToDelete.account_id) {
            return { ...account, balance: newBalance };
          }
          return account;
        }));
      }

      // Remove transaction from list
      setTransactions(prev => prev.filter(trans => trans.id !== transactionId));
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleUpdateSettings = (newSettings: typeof settings) => {
    console.log('Updating settings:', newSettings);
    updateSettings(newSettings);
  };

  const handleClearAllData = async () => {
    if (!user) return;
    
    try {
      // Delete all user data from Supabase
      await supabase.from('transactions').delete().eq('user_id', user.id);
      await supabase.from('accounts').delete().eq('user_id', user.id);
      await supabase.from('categories').delete().eq('user_id', user.id);
      
      // Clear local state
      setAccounts([]);
      setTransactions([]);
      setCategories([]);
      
      toast({
        title: "Dados limpos",
        description: "Todos os dados foram removidos com sucesso",
      });
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar dados",
        variant: "destructive"
      });
    }
  };

  const openEditAccount = (account: any) => {
    setEditingAccount(account);
    setEditAccountModalOpen(true);
  };

  const handleCreditPayment = async (creditAccountId: string, bankAccountId: string, amount: number, date: Date) => {
    if (!user) return;
    
    try {
      // Find or get the "Pagamento de Fatura" category
      const { data: paymentCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', 'Pagamento de Fatura')
        .single();

      // Create payment transactions
      const creditAccount = accounts.find(acc => acc.id === creditAccountId);
      const creditTransaction = {
        description: `Pagamento fatura ${creditAccount?.name || 'cartão de crédito'}`,
        amount,
        date: date.toISOString().split('T')[0],
        type: "income" as const, // Payment reduces debt (positive for credit card)
        category_id: paymentCategory?.id || null,
        account_id: creditAccountId,
        status: "completed" as const,
        user_id: user.id
      };

      const bankTransaction = {
        description: `Pagamento fatura ${creditAccount?.name || 'cartão de crédito'}`,
        amount,
        date: date.toISOString().split('T')[0],
        type: "expense" as const, // Payment is an expense for bank account
        category_id: paymentCategory?.id || null,
        account_id: bankAccountId,
        status: "completed" as const,
        user_id: user.id
      };

      const { data: newTransactions, error } = await supabase
        .from('transactions')
        .insert(creditTransaction)
        .select();

      const { data: newTransactions2, error: error2 } = await supabase
        .from('transactions')
        .insert(bankTransaction)
        .select();

      if (error || error2) {
        console.error('Error creating credit payment:', error || error2);
        return;
      }

      const allNewTransactions = [...(newTransactions || []), ...(newTransactions2 || [])];

      setTransactions(prev => [...prev, ...allNewTransactions]);

      // Update account balances
      const bankAccount = accounts.find(acc => acc.id === bankAccountId);

      if (creditAccount && bankAccount) {
        const newCreditBalance = creditAccount.balance + amount;
        const newBankBalance = bankAccount.balance - amount;

        await Promise.all([
          supabase
            .from('accounts')
            .update({ balance: newCreditBalance })
            .eq('id', creditAccountId)
            .eq('user_id', user.id),
          supabase
            .from('accounts')
            .update({ balance: newBankBalance })
            .eq('id', bankAccountId)
            .eq('user_id', user.id)
        ]);

        setAccounts(prev => prev.map(account => {
          if (account.id === creditAccountId) {
            return { ...account, balance: newCreditBalance };
          }
          if (account.id === bankAccountId) {
            return { ...account, balance: newBankBalance };
          }
          return account;
        }));
      }
    } catch (error) {
      console.error('Error processing credit payment:', error);
    }
  };

  const openEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setEditTransactionModalOpen(true);
  };

  const openCreditPayment = (account: any) => {
    setPayingCreditAccount(account);
    setCreditPaymentModalOpen(true);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "accounts":
        return (
          <AccountsPage
            accounts={accounts}
            onAddAccount={() => setAddAccountModalOpen(true)}
            onEditAccount={openEditAccount}
            onDeleteAccount={handleDeleteAccount}
            onPayCreditCard={openCreditPayment}
            onTransfer={() => setTransferModalOpen(true)}
            initialFilterType={accountFilterType}
          />
        );
      case "credit-bills":
        return <CreditBillsPage />;
      case "transactions":
        return (
          <TransactionsPage
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            onAddTransaction={() => setAddTransactionModalOpen(true)}
            onEditTransaction={openEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onImportTransactions={handleImportTransactions}
            initialFilterType={transactionFilterType}
            initialFilterStatus={transactionFilterStatus}
            initialDateFilter={transactionDateFilter}
            initialFilterAccountType={transactionFilterAccountType}
            initialSelectedMonth={transactionSelectedMonth}
            initialCustomStartDate={transactionCustomStartDate}
            initialCustomEndDate={transactionCustomEndDate}
          />
        );
      case "categories":
        return <CategoriesPage />;
      case "analytics":
        return (
          <AnalyticsPage
            transactions={transactions}
            accounts={accounts}
          />
        );
      case "users":
        return isAdmin() ? <UserManagement /> : <Dashboard 
          transactions={transactions} 
          accounts={accounts} 
          categories={categories}
          onTransfer={() => setTransferModalOpen(true)}
          onAddTransaction={() => setAddTransactionModalOpen(true)}
          onNavigateToAccounts={(filterType) => {
            if (filterType) {
              setAccountFilterType(filterType);
            } else {
              setAccountFilterType("all");
            }
            setCurrentPage("accounts");
          }}
          onNavigateToTransactions={(filterType, filterStatus, dateFilter, filterAccountType, selectedMonth, customStartDate, customEndDate) => {
            if (filterType) {
              setTransactionFilterType(filterType);
            }
            if (filterStatus) {
              setTransactionFilterStatus(filterStatus);
            }
            if (dateFilter) {
              setTransactionDateFilter(dateFilter);
            }
            if (filterAccountType) {
              setTransactionFilterAccountType(filterAccountType);
            }
            // Store the date parameters for navigation
            setTransactionSelectedMonth(selectedMonth);
            setTransactionCustomStartDate(customStartDate);
            setTransactionCustomEndDate(customEndDate);
            setCurrentPage("transactions");
          }}
        />;
      case "system-settings":
        return isAdmin() ? <SystemSettings /> : <Dashboard 
          transactions={transactions} 
          accounts={accounts} 
          categories={categories}
          onTransfer={() => setTransferModalOpen(true)}
          onAddTransaction={() => setAddTransactionModalOpen(true)}
          onNavigateToAccounts={(filterType) => {
            if (filterType) {
              setAccountFilterType(filterType);
            } else {
              setAccountFilterType("all");
            }
            setCurrentPage("accounts");
          }}
          onNavigateToTransactions={(filterType, filterStatus, dateFilter, filterAccountType, selectedMonth, customStartDate, customEndDate) => {
            if (filterType) {
              setTransactionFilterType(filterType);
            }
            if (filterStatus) {
              setTransactionFilterStatus(filterStatus);
            }
            if (dateFilter) {
              setTransactionDateFilter(dateFilter);
            }
            if (filterAccountType) {
              setTransactionFilterAccountType(filterAccountType);
            }
            // Store the date parameters for navigation
            setTransactionSelectedMonth(selectedMonth);
            setTransactionCustomStartDate(customStartDate);
            setTransactionCustomEndDate(customEndDate);
            setCurrentPage("transactions");
          }}
        />;
      case "profile":
        return <UserProfile />;
      case "settings":
        return (
          <SettingsPage
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onClearAllData={handleClearAllData}
          />
        );
      default:
        return (
           <Dashboard
            accounts={accounts}
            transactions={transactions}
            categories={categories}
            onTransfer={() => setTransferModalOpen(true)}
            onAddTransaction={() => setAddTransactionModalOpen(true)}
            onNavigateToAccounts={(filterType) => {
              if (filterType) {
                setAccountFilterType(filterType);
              } else {
                setAccountFilterType("all");
              }
              setCurrentPage("accounts");
            }}
            onNavigateToTransactions={(filterType, filterStatus, dateFilter, filterAccountType, selectedMonth, customStartDate, customEndDate) => {
              if (filterType) {
                setTransactionFilterType(filterType);
              }
              if (filterStatus) {
                setTransactionFilterStatus(filterStatus);
              }
              if (dateFilter) {
                setTransactionDateFilter(dateFilter);
              }
              if (filterAccountType) {
                setTransactionFilterAccountType(filterAccountType);
              }
              // Store the date parameters for navigation
              setTransactionSelectedMonth(selectedMonth);
              setTransactionCustomStartDate(customStartDate);
              setTransactionCustomEndDate(customEndDate);
              setCurrentPage("transactions");
            }}
          />
        );
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // ProtectedRoute will handle redirect
  }

  return (
    <>
      <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
        <MigrationWarning onMigrationComplete={() => {
          // Reload data after migration
          window.location.reload();
        }} />
        {renderCurrentPage()}
      </Layout>

      {/* Modals */}
      <AddAccountModal
        open={addAccountModalOpen}
        onOpenChange={setAddAccountModalOpen}
        onAddAccount={handleAddAccount}
      />

      <AddTransactionModal
        open={addTransactionModalOpen}
        onOpenChange={setAddTransactionModalOpen}
        onAddTransaction={handleAddTransaction}
        onAddInstallmentTransactions={handleAddInstallmentTransactions}
        accounts={accounts}
      />

      <EditAccountModal
        open={editAccountModalOpen}
        onOpenChange={setEditAccountModalOpen}
        onEditAccount={handleEditAccount}
        account={editingAccount}
      />

      <EditTransactionModal
        open={editTransactionModalOpen}
        onOpenChange={setEditTransactionModalOpen}
        onEditTransaction={handleEditTransaction}
        transaction={editingTransaction}
        accounts={accounts}
      />

      <TransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        onTransfer={handleTransfer}
        accounts={accounts}
      />

      <CreditPaymentModal
        open={creditPaymentModalOpen}
        onOpenChange={setCreditPaymentModalOpen}
        onPayment={handleCreditPayment}
        accounts={accounts}
        creditAccount={payingCreditAccount}
      />
    </>
  );
};

const Index = () => {
  return (
    <SettingsProvider>
      <PlaniFlowApp />
    </SettingsProvider>
  );
};

export default Index;
