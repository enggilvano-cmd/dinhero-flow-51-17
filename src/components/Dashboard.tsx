import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/formatters' // Importa o formatador de centavos
import { useAccountStore } from '@/stores/AccountStore' // Importa o store unificado

interface DashboardProps {} // CORREÇÃO: Remover props desnecessárias

export const Dashboard: React.FC<DashboardProps> = () => {
  const {
    accounts,
    categories,
    loading,
    loadAccounts,
    loadCategories,
  } = useAccountStore()

  // Carrega os dados no mount (embora o Layout já deva fazer isso,
  // é uma boa prática defensiva, garantindo que os dados estejam presentes)
  React.useEffect(() => {
    if (!loading && (accounts.length === 0 || categories.length === 0)) {
      loadAccounts();
      loadCategories();
    }
  }, [loadAccounts, loadCategories])

  // Calcula o saldo total
  const totalBalance = React.useMemo(() => {
    return accounts
      .filter((acc) => acc.type !== 'credit_card' && acc.include_in_dashboard)
      .reduce((sum, acc) => sum + acc.balance, 0) // acc.balance já está em centavos (BIGINT)
  }, [accounts])

  if (loading && accounts.length === 0) {
    return <DashboardLoadingSkeleton />
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card: Saldo Total */}
        <Card>
          <CardHeader>
            <CardTitle>Saldo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {/* NOTA DO CONTADOR: 
                'totalBalance' é um BIGINT (ex: 10550).
                'formatCurrency' converte para "R$ 105,50".
              */}
              {formatCurrency(totalBalance)}
            </p>
          </CardContent>
        </Card>

        {/* Card: Número de Contas */}
        <Card>
          <CardHeader>
            <CardTitle>Contas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{accounts.length}</p>
          </CardContent>
        </Card>

        {/* Card: Número de Categorias */}
        <Card>
          <CardHeader>
            <CardTitle>Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{categories.length}</p>
          </CardContent>
        </Card>

        {/* Outros cards podem ser adicionados aqui (ex: Despesas do Mês) */}
      </div>

      {/* Seção de Contas Individuais */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Saldos das Contas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts
            .filter((acc) => acc.type !== 'credit_card' && acc.include_in_dashboard)
            .map((account) => (
              <Card key={account.id}>
                <CardHeader>
                  <CardTitle>{account.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(account.balance)}
                  </p>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </div>
  )
}

// Componente de Skeleton para o Dashboard
const DashboardLoadingSkeleton: React.FC = () => (
  <div className="container mx-auto p-4">
    <Skeleton className="h-8 w-48 mb-6" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-16" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-16" />
        </CardContent>
      </Card>
    </div>
  </div>
)