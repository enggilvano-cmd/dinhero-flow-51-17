import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  Home,
  Wallet,
  Tag,
  BarChart,
  Settings,
  Menu,
  CreditCard,
  Plus,
  ArrowRightLeft,
} from 'lucide-react'
import { Dashboard } from './Dashboard'
import { AccountsPageWrapper } from './AccountsPageWrapper'
import { TransactionPageWrapper } from './TransactionPageWrapper'
import { CategoryPageWrapper } from './CategoryPageWrapper'
import { CreditBillsPageWrapper } from './CreditBillsPageWrapper'
import { AnalyticsPageWrapper } from './AnalyticsPageWrapper'
import { SettingsPageWrapper } from './SettingsPageWrapper'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast' // CORREÇÃO: Importar useToast
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { UserProfile } from './UserProfile'
import { AddTransactionModal } from './AddTransactionModal'
import { Account } from '@/types' // CORREÇÃO: Importar Account type
import { TransferModal } from './TransferModal'
import { useAccountStore } from '@/stores/AccountStore' // Importa o novo store unificado
import { useAuth } from '@/hooks/useAuth'

const NavItem: React.FC<{
  to: string
  icon: React.ElementType
  label: string
  onClose?: () => void
}> = ({ to, icon: Icon, label, onClose }) => {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      onClick={onClose}
      className={cn(
        'flex items-center p-2 rounded-md transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="w-5 h-5 mr-3" />
      {label}
    </Link>
  )
}

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/accounts', icon: Wallet, label: 'Contas' },
  { to: '/transactions', icon: ArrowRightLeft, label: 'Transações' },
  { to: '/categories', icon: Tag, label: 'Categorias' },
  { to: '/credit-bills', icon: CreditCard, label: 'Faturas' },
  { to: '/analytics', icon: BarChart, label: 'Análises' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { session } = useAuth();
  const location = useLocation();
  const { loadAccounts, loadCategories } = useAccountStore();
  const { toast } = useToast();

  // Atualiza o título da página baseado na rota atual
  React.useEffect(() => {
    const path = location.pathname;
    const title = navItems.find(item => item.to === path)?.label || 'Dashboard';
    document.title = `${title} | DinheroFlow`;
  }, [location]);
  // Carrega os dados essenciais (contas, categorias) quando o layout é montado
  // e o usuário está logado.
  React.useEffect(() => {
    if (session) {
      loadAccounts()
      loadCategories()
    }
  }, [session, loadAccounts, loadCategories]) // Adiciona as funções ao array de dependência

  // Se não houver sessão, não renderiza o layout principal
  if (!session) {
    return null;
  }

  // Função para lidar com transferências
  const handleTransfer = async (fromAccountId: string, toAccountId: string, amountInCents: number, date: Date): Promise<{ fromAccount: Account, toAccount: Account }> => {
    try {
      await useAccountStore.getState().createTransfer(
        {
          fromAccountId,
          toAccountId,
          amount: amountInCents,
          date: date.toISOString().split('T')[0], // Formato YYYY-MM-DD
        }
      );
      // Após a transferência, o store já recarregou as contas.
      // Precisamos buscar as contas atualizadas para retornar.
      const updatedAccounts = useAccountStore.getState().accounts;
      const fromAccount = updatedAccounts.find(acc => acc.id === fromAccountId);
      const toAccount = updatedAccounts.find(acc => acc.id === toAccountId);

      if (!fromAccount || !toAccount) {
        throw new Error("Contas atualizadas não encontradas após transferência.");
      }
      return { fromAccount, toAccount };
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao realizar transferência.', variant: 'destructive' });
      throw error;
    }
  };

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">DinheroFlow</h2>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} onClose={onClose} />
        ))}
      </nav>
      <div className="p-4 border-t">
        <UserProfile />
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col border-r fixed h-full">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64">
        {/* Header (Mobile) */}
        <header className="md:hidden flex items-center justify-between p-4 border-b">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <SidebarContent onClose={() => document.dispatchEvent(new Event('close-sheet'))} /> 
            </SheetContent> 
          </Sheet>
          <span className="text-lg font-bold">DinheroFlow</span>
          <div className="flex items-center gap-2">
            <TransferModal onTransfer={handleTransfer}>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Transferir
              </Button>
            </TransferModal>
            <AddTransactionModal />
          </div>
        </header>

        {/* Header (Desktop) */}
        <header className="hidden md:flex items-center justify-end p-4 border-b min-h-[65px]">
          <div className="flex items-center gap-2">
            <TransferModal onTransfer={handleTransfer}>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Transferir
              </Button>
            </TransferModal>
            <AddTransactionModal />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 mt-[65px] md:mt-[65px]">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<AccountsPageWrapper />} />
              <Route path="/transactions" element={<TransactionPageWrapper />} />
              <Route path="/categories" element={<CategoryPageWrapper />} />
              <Route path="/credit-bills" element={<CreditBillsPageWrapper />} />
              <Route path="/analytics" element={<AnalyticsPageWrapper />} />
              <Route path="/settings" element={<SettingsPageWrapper />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}
// CORREÇÃO: Remover a função 'cn' duplicada, ela já é importada de '@/lib/utils'
// import { cn } from '@/lib/utils'