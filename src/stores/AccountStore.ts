import { create } from 'zustand';
import { Account } from '@/types'; // Assumindo que seu tipo 'Account' está em @/types

// Define a interface para o estado e ações do store
interface AccountStoreState {
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;
  updateAccount: (updatedAccount: Account) => void;
  removeAccount: (accountId: string) => void;
}

/**
 * Store global para gerenciar as contas do usuário.
 */
export const useAccountStore = create<AccountStoreState>((set) => ({
  accounts: [],
  
  /**
   * Define a lista inteira de contas (usado na carga inicial).
   */
  setAccounts: (accounts) => set({ accounts }),

  /**
   * Adiciona uma nova conta à lista.
   */
  addAccount: (account) => set((state) => ({
    accounts: [...state.accounts, account]
  })),

  /**
   * Atualiza uma ou mais contas na lista.
   */
  updateAccount: (updatedAccount) => set((state) => ({
    accounts: state.accounts.map(account =>
      account.id === updatedAccount.id ? updatedAccount : account
    )
  })),

  /**
   * Remove uma conta da lista pelo ID.
   */
  removeAccount: (accountId) => set((state) => ({
    accounts: state.accounts.filter(account => account.id !== accountId)
  })),
}));