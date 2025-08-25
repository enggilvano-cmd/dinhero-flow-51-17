import { createDateFromString } from "@/lib/dateUtils";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, 
  Search, 
  Filter,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Edit,
  Trash2,
  MoreVertical,
  Calendar,
  CalendarIcon,
  Download,
  Upload,
  BarChart3,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { useChartResponsive } from "@/hooks/useChartResponsive";
// Interfaces moved to be inline as we're using Supabase types
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { ImportTransactionsModal } from "./ImportTransactionsModal";

interface TransactionsPageProps {
  transactions: any[];
  accounts: any[];
  categories: any[];
  onAddTransaction: () => void;
  onEditTransaction: (transaction: any) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onImportTransactions: (transactions: any[]) => void;
  initialFilterType?: "income" | "expense" | "transfer" | "all";
  initialFilterStatus?: "all" | "pending" | "completed";
  initialDateFilter?: "all" | "current_month" | "month_picker" | "custom";
  initialFilterAccountType?: "all" | "checking" | "savings" | "credit";
  initialSelectedMonth?: Date;
  initialCustomStartDate?: Date;
  initialCustomEndDate?: Date;
}

export function TransactionsPage({ 
  transactions, 
  accounts, 
  categories,
  onAddTransaction, 
  onEditTransaction, 
  onDeleteTransaction,
  onImportTransactions,
  initialFilterType = "all",
  initialFilterStatus = "all",
  initialDateFilter = "all",
  initialFilterAccountType = "all",
  initialSelectedMonth,
  initialCustomStartDate,
  initialCustomEndDate
}: TransactionsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "transfer">(initialFilterType);
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">(initialFilterStatus);
  const [filterAccountType, setFilterAccountType] = useState<string>(initialFilterAccountType);
  const [dateFilter, setDateFilter] = useState<"all" | "current_month" | "month_picker" | "custom">(initialDateFilter);
  const [selectedMonth, setSelectedMonth] = useState<Date>(initialSelectedMonth || new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(initialCustomStartDate);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(initialCustomEndDate);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [importModalOpen, setImportModalOpen] = useState(false);
  
  const { toast } = useToast();
  const { isMobile, isTablet } = useChartResponsive();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "income": return <TrendingUp className="h-4 w-4 text-success" />;
      case "expense": return <TrendingDown className="h-4 w-4 text-destructive" />;
      case "transfer": return <ArrowLeftRight className="h-4 w-4 text-primary" />;
      default: return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    const variants = {
      income: "default",
      expense: "destructive",
      transfer: "secondary"
    } as const;
    return variants[type as keyof typeof variants] || "default";
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "income": return "Receita";
      case "expense": return "Despesa";
      case "transfer": return "Transferência";
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return "destructive";
      case "completed": return "default";
      default: return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendente";
      case "completed": return "Concluída";
      default: return status;
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account?.name || "Conta não encontrada";
  };

  const getCategoryName = (categoryId: string, isTransfer: boolean = false) => {
    if (isTransfer) return "Transferência";
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || "";
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter(transaction => {
      const transactionDate = typeof transaction.date === 'string' ? createDateFromString(transaction.date) : transaction.date;
      
      const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           getCategoryName(transaction.category_id, transaction.to_account_id != null).toLowerCase().includes(searchTerm.toLowerCase());
      
      // Check transaction type - transfers are now stored as income/expense with to_account_id
      const isTransfer = transaction.to_account_id != null;
      const transactionType = isTransfer ? "transfer" : transaction.type;
      
      const matchesType = filterType === "all" || 
                        (filterType === "transfer" && isTransfer) ||
                        (filterType !== "transfer" && !isTransfer && transaction.type === filterType);
      const matchesAccount = filterAccount === "all" || 
                        transaction.account_id === filterAccount;
      const matchesCategory = filterCategory === "all" || 
                        transaction.category_id === filterCategory;
      const matchesStatus = filterStatus === "all" || transaction.status === filterStatus;
      
      // Filter by account type
      const account = accounts.find(acc => acc.id === transaction.account_id);
      const matchesAccountType = filterAccountType === "all" || 
                        (account && account.type === filterAccountType);
      
      let matchesPeriod = true;
      // Filtro por data
      if (dateFilter === "current_month") {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        matchesPeriod = isWithinInterval(transactionDate, { start, end });
      } else if (dateFilter === "month_picker") {
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);
        matchesPeriod = isWithinInterval(transactionDate, { start, end });
      } else if (dateFilter === "custom" && customStartDate && customEndDate) {
        matchesPeriod = isWithinInterval(transactionDate, { 
          start: customStartDate, 
          end: customEndDate 
        });
      }
      
      return matchesSearch && matchesType && matchesAccount && matchesCategory && matchesStatus && matchesAccountType && matchesPeriod;
    });

    // Sort transactions
    filtered.sort((a, b) => {
      let comparison = 0;
      const aDate = typeof a.date === 'string' ? createDateFromString(a.date) : a.date;
      const bDate = typeof b.date === 'string' ? createDateFromString(b.date) : b.date;
      
      if (sortBy === "date") {
        comparison = aDate.getTime() - bDate.getTime();
      } else if (sortBy === "amount") {
        comparison = a.amount - b.amount;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, accounts, searchTerm, filterType, filterAccount, filterCategory, filterStatus, filterAccountType, dateFilter, selectedMonth, customStartDate, customEndDate, sortBy, sortOrder]);

  const handleDeleteTransaction = (transaction: any) => {
    if (window.confirm(`Tem certeza que deseja excluir a transação "${transaction.description}"?`)) {
      onDeleteTransaction(transaction.id);
      toast({
        title: "Transação excluída",
        description: `A transação "${transaction.description}" foi excluída com sucesso.`,
      });
    }
  };

  const totals = useMemo(() => {
    return filteredAndSortedTransactions.reduce((acc, transaction) => {
      // Skip transfers as they don't affect total income/expenses
      const isTransfer = transaction.to_account_id != null;
      if (!isTransfer) {
        if (transaction.type === "income") {
          acc.income += transaction.amount;
        } else if (transaction.type === "expense") {
          acc.expenses += transaction.amount;
        }
      }
      return acc;
    }, { income: 0, expenses: 0 });
  }, [filteredAndSortedTransactions]);

  const exportToExcel = () => {
    const dataToExport = filteredAndSortedTransactions.map(transaction => {
      const transactionDate = typeof transaction.date === 'string' ? createDateFromString(transaction.date) : transaction.date;
      const isTransfer = transaction.to_account_id != null;
      const transactionType = isTransfer ? "transfer" : transaction.type;
      
      return {
        'Data': format(transactionDate, "dd/MM/yyyy", { locale: ptBR }),
        'Descrição': transaction.description,
        'Categoria': getCategoryName(transaction.category_id, isTransfer),
        'Tipo': getTransactionTypeLabel(transactionType),
        'Conta': getAccountName(transaction.account_id),
        'Valor': transaction.amount,
        'Status': getStatusLabel(transaction.status),
        'Parcelas': transaction.installments ? `${transaction.current_installment}/${transaction.installments}` : 'N/A'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transações");

    // Configurar largura das colunas
    const colWidths = [
      { wch: 12 }, // Data
      { wch: 30 }, // Descrição
      { wch: 20 }, // Categoria
      { wch: 15 }, // Tipo
      { wch: 25 }, // Conta
      { wch: 15 }, // Valor
      { wch: 12 }, // Status
      { wch: 12 }  // Parcelas
    ];
    ws['!cols'] = colWidths;

    // Gerar nome do arquivo com filtros aplicados
    let fileName = 'transacoes';
    if (filterType !== 'all') fileName += `_${filterType}`;
    if (dateFilter === 'current_month') fileName += '_mes-atual';
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      fileName += `_${format(customStartDate, 'dd-MM-yyyy')}_${format(customEndDate, 'dd-MM-yyyy')}`;
    }
    fileName += '.xlsx';

    XLSX.writeFile(wb, fileName);

    toast({
      title: "Exportação concluída",
      description: `${filteredAndSortedTransactions.length} transações exportadas para Excel.`,
    });
  };

  // Configure table columns
  const tableColumns = [
    {
      key: 'info',
      header: 'Transação',
      width: '30%',
      render: (transaction: any) => (
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className={`p-1.5 sm:p-2 bg-background rounded-lg flex-shrink-0`}>
            {getTransactionIcon(transaction.to_account_id ? "transfer" : transaction.type)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm sm:text-base truncate">
              {transaction.description}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {format(typeof transaction.date === 'string' ? createDateFromString(transaction.date) : transaction.date, "dd/MM/yyyy", { locale: ptBR })}
            </div>
            {/* Mostrar categoria e conta no mobile dentro da coluna principal */}
            <div className="block sm:hidden text-xs text-muted-foreground mt-1 space-y-0.5">
              <div className="truncate">{getCategoryName(transaction.category_id, transaction.to_account_id != null)}</div>
              <div className="truncate">{getAccountName(transaction.account_id)}</div>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Categoria',
      hideOnMobile: true, // Oculta apenas em mobile (< 640px)
      width: '15%',
      render: (transaction: any) => (
        <span className="text-sm truncate">{getCategoryName(transaction.category_id, transaction.to_account_id != null)}</span>
      )
    },
    {
      key: 'account',
      header: 'Conta',
      hideOnMobile: true, // Oculta apenas em mobile
      width: '15%',
      render: (transaction: any) => (
        <span className="text-sm truncate">{getAccountName(transaction.account_id)}</span>
      )
    },
    {
      key: 'type',
      header: 'Tipo',
      mobileLabel: 'Tipo',
      width: '12%',
      render: (transaction: any) => (
        <Badge variant={getTransactionTypeBadge(transaction.to_account_id ? "transfer" : transaction.type)} className="text-xs">
          {getTransactionTypeLabel(transaction.to_account_id ? "transfer" : transaction.type)}
        </Badge>
      )
    },
    {
      key: 'status',
      header: 'Status',
      mobileLabel: 'Status',
      width: '13%',
      render: (transaction: any) => (
        <div className="flex flex-col gap-1">
          <Badge variant={getStatusBadge(transaction.status)} className="text-xs w-fit">
            {getStatusLabel(transaction.status)}
          </Badge>
          {transaction.installments && transaction.current_installment && (
            <Badge variant="outline" className="text-xs w-fit">
              {transaction.current_installment}/{transaction.installments}
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Valor',
      mobileLabel: 'Valor',
      width: '15%',
      render: (transaction: any) => (
        <div className={`font-bold text-sm sm:text-base ${
          transaction.type === "income" ? "balance-positive" : "balance-negative"
        }`}>
          {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Ações',
      mobileLabel: 'Ações',
      width: '10%',
      render: (transaction: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditTransaction(transaction)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDeleteTransaction(transaction)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  return (
    <div className="spacing-responsive-lg fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-title-1">Transações</h1>
          <p className="text-body text-muted-foreground">
            Histórico completo de receitas, despesas e transferências
          </p>
        </div>
        <div className="flex flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={() => setImportModalOpen(true)} 
            className="gap-2 apple-interaction"
          >
            <Upload className="h-4 w-4" />
            <span>Importar</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={exportToExcel} 
            className="gap-2 apple-interaction"
            disabled={filteredAndSortedTransactions.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>Exportar</span>
          </Button>
          <Button 
            onClick={onAddTransaction} 
            className="gap-2 apple-interaction"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-caption font-medium text-muted-foreground">Total de Transações</p>
                <div className="text-responsive-xl font-bold leading-tight">
                  {filteredAndSortedTransactions.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-caption font-medium text-muted-foreground">Total Receitas</p>
                <div className="text-responsive-xl font-bold balance-positive leading-tight">
                  {formatCurrency(totals.income)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-caption font-medium text-muted-foreground">Total Despesas</p>
                <div className="text-responsive-xl font-bold balance-negative leading-tight">
                  {formatCurrency(totals.expenses)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-caption font-medium text-muted-foreground">Saldo Líquido</p>
                <div className={`text-responsive-xl font-bold leading-tight ${
                  (totals.income - totals.expenses) >= 0 ? "balance-positive" : "balance-negative"
                }`}>
                  {formatCurrency(totals.income - totals.expenses)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="financial-card">
        <CardContent className="py-4 sm:pt-6">
          <div className="space-y-4">
            {/* Filtros principais - sempre visíveis */}
            <div className="space-y-3">
              {/* Busca - linha completa em mobile */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar transações..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>

              {/* Filtros rápidos - 2 colunas em mobile, 4 em desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="income">Receitas</SelectItem>
                    <SelectItem value="expense">Despesas</SelectItem>
                    <SelectItem value="transfer">Transferências</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="completed">Concluídas</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={(value: "all" | "current_month" | "month_picker" | "custom") => setDateFilter(value)}>
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="current_month">Mês Atual</SelectItem>
                    <SelectItem value="month_picker">Navegar por Mês</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-1">
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="flex-1 h-9 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Data</SelectItem>
                      <SelectItem value="amount">Valor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-xs"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Filtros avançados - seção colapsível */}
            <div className="border-t border-border pt-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Filtros Avançados</h4>
                
                {/* Contas e categorias - 1 coluna em mobile, 3 em desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  <Select value={filterAccountType} onValueChange={setFilterAccountType}>
                    <SelectTrigger className="h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Tipo de Conta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="checking">Conta Corrente</SelectItem>
                      <SelectItem value="credit">Cartão de Crédito</SelectItem>
                      <SelectItem value="investment">Investimentos</SelectItem>
                      <SelectItem value="savings">Poupança</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className="h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Conta Específica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: account.color || "#6b7280" }}
                            />
                            <span className="truncate">{account.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: category.color || "#6b7280" }}
                            />
                            <span className="truncate">{category.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Controles de data - mostrar apenas quando necessário */}
            {dateFilter === "month_picker" && (
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-1 h-9 px-3 border border-input rounded-md bg-background">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="flex-1 text-center text-sm font-medium">
                    {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {dateFilter === "custom" && (
              <div className="border-t border-border pt-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-9 justify-start text-left font-normal text-xs sm:text-sm",
                          !customStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="truncate">
                          {customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Data Início"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customStartDate}
                        onSelect={(date) => {
                          setCustomStartDate(date);
                          setStartDatePickerOpen(false);
                        }}
                        initialFocus
                        className="p-3"
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-9 justify-start text-left font-normal text-xs sm:text-sm",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="truncate">
                          {customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Data Fim"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customEndDate}
                        onSelect={(date) => {
                          setCustomEndDate(date);
                          setEndDatePickerOpen(false);
                        }}
                        initialFocus
                        className="p-3"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card className="financial-card">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">
            Transações ({filteredAndSortedTransactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ResponsiveTable
            data={filteredAndSortedTransactions}
            columns={tableColumns}
            keyField="id"
            emptyState={
              <div className="text-center py-8 sm:py-12 px-4 sm:px-6">
                <Calendar className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-base sm:text-lg font-semibold mb-2">
                  Nenhuma transação encontrada
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Tente ajustar os filtros ou adicione uma nova transação
                </p>
                <Button onClick={onAddTransaction} className="text-sm">
                  Adicionar Transação
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      <ImportTransactionsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        accounts={accounts}
        onImportTransactions={onImportTransactions}
      />
    </div>
  );
}