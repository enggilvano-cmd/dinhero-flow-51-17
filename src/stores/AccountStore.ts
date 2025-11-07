import { create } from 'zustand';
import { Account } from '@/types'; // Assumindo que seu tipo 'Account' está em @/types

// Define a interface para o estado e ações do store
interface AccountStoreState {
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;
  updateAccounts: (updatedAccounts: Account | Account[]) => void;
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
   * Aceita um único objeto Account ou um array de Accounts.
   */
  updateAccounts: (updatedAccounts) => set((state) => {
    // Garante que estamos trabalhando com um array
    const accountsToUpdate = Array.isArray(updatedAccounts) ? updatedAccounts : [updatedAccounts];
    
    // Cria um Map para consulta rápida dos IDs das contas atualizadas
    const updatedMap = new Map(accountsToUpdate.map(acc => [acc.id, acc]));

    // Mapeia as contas existentes, substituindo as que foram atualizadas
    const newAccounts = state.accounts.map(account => 
      updatedMap.get(account.id) || account
    );

    return { accounts: newAccounts };
  }),

  /**
   * Remove uma conta da lista pelo ID.
   */
  removeAccount: (accountId) => set((state) => ({
    accounts: state.accounts.filter(account => account.id !== accountId)
  })),
}));