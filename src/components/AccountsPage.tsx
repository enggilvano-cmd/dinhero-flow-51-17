import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  CreditCard, 
  PiggyBank, 
  Wallet,
  MoreVertical,
  ArrowRight,
  DollarSign
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
// Account interface moved to be inline as we're using Supabase types

interface AccountsPageProps {
  accounts: any[];
  onAddAccount: () => void;
  onEditAccount: (account: any) => void;
  onDeleteAccount: (accountId: string) => void;
  onPayCreditCard?: (account: any) => void;
  onTransfer?: () => void;
  initialFilterType?: "all" | "checking" | "savings" | "credit";
}

export function AccountsPage({ 
  accounts, 
  onAddAccount, 
  onEditAccount, 
  onDeleteAccount,
  onPayCreditCard,
  onTransfer,
  initialFilterType = "all"
}: AccountsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "checking" | "savings" | "credit">(initialFilterType);
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "checking": return <Wallet className="h-5 w-5" />;
      case "savings": return <PiggyBank className="h-5 w-5" />;
      case "credit": return <CreditCard className="h-5 w-5" />;
      default: return <Wallet className="h-5 w-5" />;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "checking": return "Conta Corrente";
      case "savings": return "Poupança";
      case "credit": return "Cartão de Crédito";
      default: return type;
    }
  };

  const getAccountTypeBadge = (type: string) => {
    const variants = {
      checking: "default",
      savings: "secondary", 
      credit: "destructive"
    } as const;
    return variants[type as keyof typeof variants] || "default";
  };

  const filteredAccounts = accounts
    .filter(account => {
      const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || account.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  const handleDeleteAccount = (account: any) => {
    if (window.confirm(`Tem certeza que deseja excluir a conta "${account.name}"?`)) {
      onDeleteAccount(account.id);
      toast({
        title: "Conta excluída",
        description: `A conta "${account.name}" foi excluída com sucesso.`,
      });
    }
  };

  const totalBalance = accounts
    .filter(acc => acc.type !== "credit")
    .reduce((sum, acc) => sum + acc.balance, 0);

  const creditUsed = accounts
    .filter(acc => acc.type === "credit")
    .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);

  return (
    <div className="spacing-responsive-lg fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-title-1">Contas</h1>
          <p className="text-body text-muted-foreground">
            Gerencie suas contas bancárias e cartões de crédito
          </p>
        </div>
        <div className="flex gap-3">
          {onTransfer && (
            <Button onClick={onTransfer} variant="outline" className="gap-2 apple-interaction">
              <ArrowRight className="h-4 w-4" />
              Transferir
            </Button>
          )}
          <Button onClick={onAddAccount} className="gap-2 apple-interaction">
            <Plus className="h-4 w-4" />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* Summary Cards - Layout otimizado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total em Contas</p>
                <div className="text-base sm:text-lg lg:text-xl font-bold balance-positive leading-tight">
                  {formatCurrency(totalBalance)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Cartões Utilizados</p>
                <div className="text-base sm:text-lg lg:text-xl font-bold balance-negative leading-tight">
                  {formatCurrency(creditUsed)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card sm:col-span-2 xl:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total de Contas</p>
                <div className="text-base sm:text-lg lg:text-xl font-bold leading-tight">
                  {accounts.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros - Layout compacto */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {[
            { value: "all", label: "Todas" },
            { value: "checking", label: "Corrente" },
            { value: "savings", label: "Poupança" },
            { value: "credit", label: "Cartão" }
          ].map((filter) => (
            <Button
              key={filter.value}
              variant={filterType === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(filter.value as any)}
              className="apple-interaction h-10 whitespace-nowrap"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Accounts Grid */}
      {filteredAccounts.length === 0 ? (
        <Card className="financial-card">
          <CardContent className="text-center py-12">
            <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || filterType !== "all" 
                ? "Nenhuma conta encontrada" 
                : "Nenhuma conta cadastrada"
              }
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterType !== "all"
                ? "Tente ajustar os filtros de busca"
                : "Comece adicionando sua primeira conta bancária ou cartão de crédito"
              }
            </p>
            {(!searchTerm && filterType === "all") && (
              <Button onClick={onAddAccount}>
                Adicionar Conta
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredAccounts.map((account) => (
            <Card key={account.id} className="financial-card apple-interaction group">
              <CardContent className="p-3 sm:p-4">
                {/* Layout Mobile vs Desktop */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Header com Ícone, Nome e Menu */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Ícone da Conta */}
                    <div 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: account.color || "#6b7280" }}
                    >
                      {getAccountIcon(account.type)}
                    </div>
                    
                    {/* Nome e Badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-semibold truncate mb-1">{account.name}</h3>
                          <Badge 
                            variant={getAccountTypeBadge(account.type)}
                            className="text-xs h-5 px-2 inline-flex"
                          >
                            {getAccountTypeLabel(account.type)}
                          </Badge>
                        </div>
                        
                        {/* Menu de Ações - sempre visível no mobile */}
                        <div className="flex-shrink-0 ml-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 sm:opacity-70 sm:group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4 sm:h-3 sm:w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditAccount(account)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {account.type === "credit" && account.balance < 0 && onPayCreditCard && (
                                <DropdownMenuItem onClick={() => onPayCreditCard(account)}>
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Pagar Fatura
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDeleteAccount(account)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Saldo e Informações Financeiras */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:flex-shrink-0">
                    {/* Saldo */}
                    <div className="flex items-center justify-between sm:justify-start gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                        Saldo:
                      </span>
                      <span className={`text-sm sm:text-base font-bold ${
                        account.type === "credit" 
                          ? "balance-negative" 
                          : account.balance >= 0 ? "balance-positive" : "balance-negative"
                      }`}>
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                    
                    {/* Informações do Limite - Layout responsivo */}
                    {account.limit_amount > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          <span className="text-xs sm:text-sm text-muted-foreground">Limite:</span>
                          <span className="text-xs sm:text-sm font-medium">{formatCurrency(account.limit_amount)}</span>
                        </div>
                        
                        {/* Barra de progresso */}
                        <div className="flex items-center gap-2">
                          <div className="w-20 sm:w-16 bg-muted rounded-full h-2 sm:h-1">
                            <div 
                              className={`h-2 sm:h-1 rounded-full transition-all duration-300 ${
                                account.type === "credit" 
                                  ? "bg-destructive" 
                                  : "bg-warning"
                              }`}
                              style={{ 
                                width: `${Math.min(
                                  Math.max(
                                    account.type === "credit" 
                                      ? (Math.abs(account.balance) / account.limit_amount) * 100
                                      : account.balance < 0 
                                      ? (Math.abs(account.balance) / account.limit_amount) * 100
                                      : 0,
                                    0
                                  ),
                                  100
                                )}%` 
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground font-medium min-w-[3rem] text-right">
                            {Math.round(
                              account.type === "credit" 
                                ? (Math.abs(account.balance) / account.limit_amount) * 100
                                : account.balance < 0 
                                ? (Math.abs(account.balance) / account.limit_amount) * 100
                                : 0
                            )}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}