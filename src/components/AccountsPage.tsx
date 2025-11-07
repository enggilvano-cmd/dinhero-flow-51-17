import React from 'react'
import { useState, useEffect } from 'react'; // CORREÇÃO: Importar useState e useEffect
import { useAccountStore } from '@/stores/AccountStore' // Importa o hook 'create' padrão
import { formatCurrency } from '@/lib/formatters' // Importa o formatador de centavos
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from './ui/card'
import { Button } from './ui/button'
import { Plus } from 'lucide-react'
import { Skeleton } from './ui/skeleton'
import { AddAccountModal } from './AddAccountModal'
import { EditAccountModal } from './EditAccountModal'
import { Account } from '@/types'; // CORREÇÃO: Importar o tipo Account
import { supabase } from '@/integrations/supabase/client'; // CORREÇÃO: Importar supabase

/**
 * Componente de esqueleto para carregamento
 */
const AccountsLoadingSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-20" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Página principal de Contas
 */
export const AccountsPage: React.FC = () => {
  // NOTA DO PROGRAMADOR:
  // O uso do store agora é idiomático e simples.
  // 'useSyncExternalStore' foi removido.
  const { accounts, loading, loadAccounts, addAccount: addAccountToStore, updateAccount: updateAccountInStore } = useAccountStore()

  useEffect(() => { // CORREÇÃO: Usar useEffect
    if (!loading && accounts.length === 0) { // CORREÇÃO: Carregar apenas se não estiver carregando e não houver contas
      loadAccounts(); 
    }
  }, [loadAccounts, loading]);

  const handleAddAccount = async (newAccountData: Omit<Account, "id" | "user_id" | "created_at" | "updated_at">): Promise<Account> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('accounts')
      .insert({ ...newAccountData, user_id: userData.user.id })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const handleEditAccount = async (updatedAccountData: Account): Promise<Account> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('accounts')
      .update({
        name: updatedAccountData.name,
        type: updatedAccountData.type,
        balance: updatedAccountData.balance,
        limit_amount: updatedAccountData.limit_amount,
        due_date: updatedAccountData.due_date,
        closing_date: updatedAccountData.closing_date,
        color: updatedAccountData.color,
      })
      .eq('id', updatedAccountData.id)
      .eq('user_id', userData.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  if (loading && accounts.length === 0) {
    return <AccountsLoadingSkeleton />
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Contas</h1>
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Conta
        </Button>
        <AddAccountModal open={addModalOpen} onOpenChange={setAddModalOpen} onAddAccount={handleAddAccount} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <Card key={account.id} className="flex flex-col">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>{account.name}</CardTitle>
              {/* Exibe a cor da conta */}
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: account.color || '#ccc' }}
              />
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground capitalize">
                {account.type.replace('_', ' ')}
              </p>
              <p className="text-2xl font-bold">
                {/* NOTA DO CONTADOR: 
                  O valor 'account.balance' vem do banco como um inteiro (ex: 1050).
                  'formatCurrency' o converte para a string "R$ 10,50".
                */}
                {formatCurrency(account.balance)}
              </p>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedAccount(account);
                  setEditModalOpen(true);
                }}
              >
                Editar
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {selectedAccount && (
        <EditAccountModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onEditAccount={handleEditAccount}
          account={selectedAccount}
        />
      )}
    </div>
  );
}