import { createDateFromString } from "@/lib/dateUtils";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  Download,
  Calendar as CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useChartResponsive } from "@/hooks/useChartResponsive";
import { 
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/ui/chart";
import { 
  formatCurrencyForAxis, 
  getPieChartProps, 
  getBarChartAxisProps, 
  getLineChartProps, 
  getComposedChartMargins 
} from "@/lib/chartUtils";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Area,
  AreaChart,
  ComposedChart
} from "recharts";
import { generateCategoryReport, generateMonthlyReport, exportToCSV, exportToPDF } from "@/lib/reports";
import { startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth, isSameYear, format, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useCategories";

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  color: string;
  limit_amount?: number;
  due_date?: number;
  closing_date?: number;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date | string;
  type: "income" | "expense" | "transfer";
  category: string;
  category_id?: string;
  accountId?: string;
  account_id?: string;
  status: "pending" | "completed";
  to_account_id?: string;
}

interface AnalyticsPageProps {
  transactions: Transaction[];
  accounts: Account[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "hsl(var(--muted))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300"
];

export default function AnalyticsPage({ transactions, accounts }: AnalyticsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "current_month" | "month_picker" | "custom">("all");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  const { chartConfig: responsiveConfig, isMobile, isTablet, isDesktop } = useChartResponsive();
  const { categories } = useCategories();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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

  const getTransactionAccountId = (transaction: Transaction) => {
    return transaction.account_id || transaction.accountId || '';
  };

  const getTransactionCategory = (transaction: Transaction) => {
    // Check if it's a transfer
    if (transaction.to_account_id) {
      return 'Transferência';
    }
    
    // Debug log to identify the problematic transaction
    if (transaction.category && typeof transaction.category === 'string' && transaction.category.includes('-')) {
      console.log('Transaction with category ID instead of name:', transaction);
    }
    
    if (transaction.category_id) {
      const category = categories.find(cat => cat.id === transaction.category_id);
      return category?.name || 'Categoria não encontrada';
    }
    
    // If transaction.category exists and it's not an ID, use it
    if (transaction.category && !transaction.category.includes('-')) {
      return transaction.category;
    }
    
    return 'Sem categoria';
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const transactionDate = typeof transaction.date === 'string' ? createDateFromString(transaction.date) : transaction.date;
      
      const matchesSearch = !searchTerm || 
                           transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           getTransactionCategory(transaction).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || transaction.type === filterType;
      const matchesAccount = filterAccount === "all" || getTransactionAccountId(transaction) === filterAccount;
      const matchesCategory = filterCategory === "all" || transaction.category_id === filterCategory;
      const matchesStatus = filterStatus === "all" || transaction.status === filterStatus;
      
      let matchesPeriod = true;
      if (dateFilter === "current_month") {
        matchesPeriod = isSameMonth(transactionDate, new Date()) && 
                       isSameYear(transactionDate, new Date());
      } else if (dateFilter === "month_picker") {
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);
        matchesPeriod = isWithinInterval(transactionDate, { start, end });
      } else if (dateFilter === "custom" && customStartDate && customEndDate) {
        matchesPeriod = transactionDate >= customStartDate && transactionDate <= customEndDate;
      }
      
      return matchesSearch && matchesType && matchesAccount && matchesCategory && matchesStatus && matchesPeriod;
    });
  }, [transactions, searchTerm, filterType, filterAccount, filterCategory, filterStatus, dateFilter, selectedMonth, customStartDate, customEndDate, categories]);

  const categoryData = useMemo(() => {
    const reportType = filterType === "income" ? "income" : "expense";
    
    // Para o relatório de categoria, precisamos filtrar apenas receitas ou despesas
    const typeFilteredTransactions = filterType === "all" 
      ? filteredTransactions.filter(t => t.type === "expense") // padrão para despesas quando "all"
      : filteredTransactions.filter(t => t.type === reportType);
    
    // Filtrar pagamentos de fatura das análises de categoria
    const categoryFilteredTransactions = typeFilteredTransactions.filter(t => {
      const category = getTransactionCategory(t);
      return category !== 'Pagamento de Fatura';
    });
    
    if (categoryFilteredTransactions.length === 0) {
      return [];
    }
    
    // Criar relatório manual já que temos as transações filtradas
    const categoryTotals = categoryFilteredTransactions.reduce((acc, transaction) => {
      const category = getTransactionCategory(transaction);
      if (category) {
        acc[category] = (acc[category] || 0) + transaction.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalAmount = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);

    const report = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
        transactions: categoryFilteredTransactions.filter(t => getTransactionCategory(t) === category).length
      }))
      .sort((a, b) => b.amount - a.amount);
    
    return report.map((item, index) => ({
      ...item,
      fill: COLORS[index % COLORS.length]
    }));
  }, [filteredTransactions, filterType, categories]);

  const monthlyData = useMemo(() => {
    // Criar relatório manual sem depender da lib/reports
    const monthlyTotals = filteredTransactions.reduce((acc, transaction) => {
      const transactionDate = typeof transaction.date === 'string' ? createDateFromString(transaction.date) : transaction.date;
      const monthKey = format(transactionDate, 'yyyy-MM');
      
      if (!acc[monthKey]) {
        acc[monthKey] = { income: 0, expenses: 0 };
      }
      
      if (transaction.type === 'income') {
        acc[monthKey].income += transaction.amount;
      } else if (transaction.type === 'expense') {
        acc[monthKey].expenses += transaction.amount;
      }
      
      return acc;
    }, {} as Record<string, { income: number; expenses: number }>);

    // Converter para array e ordenar
    const sortedEntries = Object.entries(monthlyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6); // Últimos 6 meses
    
    let saldoAcumulado = 0;
    const sortedMonths = sortedEntries.map(([monthKey, data]) => {
      const saldoMensal = data.income - data.expenses;
      saldoAcumulado += saldoMensal;
      
    // Parse year and month from monthKey to avoid timezone issues
    const [year, month] = monthKey.split('-').map(num => parseInt(num, 10));
    
    return {
      month: format(new Date(year, month - 1, 1), 'MMM yyyy', { locale: ptBR }),
      receitas: data.income,
      despesas: data.expenses,
      saldo: saldoAcumulado,
      income: data.income,
      expenses: data.expenses,
      balance: saldoAcumulado
    };
    });

    return sortedMonths;
  }, [filteredTransactions]);

  const totalsByType = useMemo(() => {
    return filteredTransactions.reduce((acc, transaction) => {
      if (transaction.type === "income") {
        acc.income += transaction.amount;
      } else if (transaction.type === "expense") {
        acc.expenses += transaction.amount;
      }
      return acc;
    }, { income: 0, expenses: 0 });
  }, [filteredTransactions]);

  const accountBalanceData = useMemo(() => {
    return accounts
      .filter(acc => acc.type !== "credit")
      .map(account => ({
        name: account.name.split(" - ")[0] || account.name,
        balance: account.balance,
        type: account.type,
        color: account.color || "hsl(var(--primary))"
      }));
  }, [accounts]);

  // Chart config específico para o gráfico de saldos de contas
  const accountChartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    accountBalanceData.forEach(account => {
      config[account.name] = {
        label: account.name,
        color: account.color
      };
    });
    return config;
  }, [accountBalanceData]);

  const handleExportCSV = () => {
    const data = categoryData.map(item => ({
      Categoria: item.category,
      Valor: item.amount,
      Porcentagem: `${item.percentage.toFixed(1)}%`,
      Transações: item.transactions
    }));

    exportToCSV(data, `relatorio-analise-${filterType}`);
    toast({
      title: "Relatório exportado",
      description: "O arquivo CSV foi baixado com sucesso.",
    });
  };

  const handleExportPDF = () => {
    const data = categoryData.map(item => ({
      Categoria: item.category,
      Valor: formatCurrency(item.amount),
      Porcentagem: `${item.percentage.toFixed(1)}%`,
      Transações: item.transactions
    }));

    const reportTypeLabel = filterType === "income" ? "Receitas" : filterType === "expense" ? "Despesas" : "Todas as Transações";
    exportToPDF(data, `Relatório de ${reportTypeLabel}`);
    toast({
      title: "Relatório gerado",
      description: "O relatório PDF foi aberto para impressão.",
    });
  };

  const chartConfig = {
    receitas: {
      label: "Receitas",
      color: "hsl(var(--success))",
    },
    despesas: {
      label: "Despesas", 
      color: "hsl(var(--destructive))",
    },
    saldo: {
      label: "Saldo",
      color: "hsl(var(--primary))",
    }
  };

  // Chart config específico para o gráfico de categorias
  const categoryChartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    categoryData.forEach((item, index) => {
      config[item.category] = {
        label: item.category,
        color: item.fill || COLORS[index % COLORS.length]
      };
    });
    return config;
  }, [categoryData]);

  // Funções para navegação de mês
  const goToPreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  return (
    <div className="spacing-responsive-lg fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-title-1">Análises</h1>
          <p className="text-body text-muted-foreground">
            Relatórios e gráficos financeiros detalhados
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExportCSV} className="gap-2 apple-interaction">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={handleExportPDF} className="gap-2 apple-interaction">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="financial-card">
        <CardHeader>
          <CardTitle className="text-headline">
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="spacing-responsive-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
                <SelectItem value="transfer">Transferências</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color || "#6b7280" }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(value: "all" | "current_month" | "month_picker" | "custom") => setDateFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                <SelectItem value="current_month">Mês Atual</SelectItem>
                <SelectItem value="month_picker">Navegar por Mês</SelectItem>
                <SelectItem value="custom">Período Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter === "month_picker" && (
              <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPreviousMonth}
                  className="h-6 w-6 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex-1 text-center text-sm font-medium min-w-[100px]">
                  {format(selectedMonth, "MMM/yyyy", { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextMonth}
                  className="h-6 w-6 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {dateFilter === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "dd/MM/yyyy") : "Data início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "dd/MM/yyyy") : "Data fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">Receitas - Período Filtrado</p>
                  <div className="text-responsive-xl font-bold balance-positive leading-tight">
                    {formatCurrency(totalsByType.income)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">Despesas - Período Filtrado</p>
                  <div className="text-responsive-xl font-bold balance-negative leading-tight">
                    {formatCurrency(totalsByType.expenses)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">Saldo Líquido - Período Filtrado</p>
                  <div className={`text-responsive-xl font-bold leading-tight ${
                    (totalsByType.income - totalsByType.expenses) >= 0 ? "balance-positive" : "balance-negative"
                  }`}>
                    {formatCurrency(totalsByType.income - totalsByType.expenses)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4">
        {/* Category Pie Chart */}
        <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <PieChart className="h-4 w-4 sm:h-5 sm:w-5" />
              {filterType === "income" ? "Receitas" : filterType === "expense" ? "Despesas" : "Transações"} por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            <ChartContainer 
              config={categoryChartConfig} 
              className={`${responsiveConfig.containerHeight} w-full overflow-hidden`}
            >
              <RechartsPieChart 
                width={undefined}
                height={undefined}
              >
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                />
                <Pie
                  data={categoryData.map(item => ({
                    ...item,
                    name: item.category,
                    value: item.amount
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={responsiveConfig.showLabels && categoryData.length <= 6
                    ? ({ name, percentage }: any) => `${name}: ${percentage.toFixed(1)}%` 
                    : false
                  }
                  outerRadius={responsiveConfig.outerRadius}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                {responsiveConfig.showLegend && categoryData.length > 0 && (
                  <ChartLegend 
                    content={<ChartLegendContent />}
                    wrapperStyle={{ paddingTop: responsiveConfig.showLabels ? '10px' : '20px' }}
                    iconType="circle"
                  />
                )}
              </RechartsPieChart>
            </ChartContainer>
            {categoryData.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                Nenhuma transação encontrada para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Balances */}
        <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              Saldos por Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            <ChartContainer config={accountChartConfig} className={`${responsiveConfig.containerHeight} w-full overflow-hidden`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountBalanceData} margin={getComposedChartMargins(responsiveConfig)}>
                  <XAxis 
                    dataKey="name" 
                    {...getBarChartAxisProps(responsiveConfig).xAxis}
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrencyForAxis(value, isMobile)}
                    {...getBarChartAxisProps(responsiveConfig).yAxis}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => [formatCurrency(value), "Saldo"]}
                  />
                  <Bar dataKey="balance">
                    {accountBalanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              Evolução Mensal - Receitas vs Despesas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            <ChartContainer config={chartConfig} className={`${responsiveConfig.containerHeight} w-full overflow-hidden`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={getComposedChartMargins(responsiveConfig)}>
                  {/* Definições de gradientes */}
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>

                  <XAxis 
                    dataKey="month" 
                    {...getBarChartAxisProps(responsiveConfig).xAxis}
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrencyForAxis(value, isMobile)}
                    {...getBarChartAxisProps(responsiveConfig).yAxis}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value), 
                      name === 'receitas' ? 'Receitas' : 
                      name === 'despesas' ? 'Despesas' : 
                      name === 'saldo' ? 'Saldo Acumulado' : name
                    ]}
                    labelFormatter={(label) => `Mês de ${label}`}
                  />

                  {/* Legenda apenas no desktop */}
                  {!isMobile && (
                    <ChartLegend 
                      content={<ChartLegendContent className="flex justify-center gap-6" />}
                      verticalAlign="top"
                    />
                  )}
                  
                  {/* Barras de Receitas com gradiente */}
                  <Bar 
                    dataKey="receitas" 
                    fill="url(#colorReceitas)"
                    radius={[4, 4, 0, 0]}
                    name="Receitas"
                  />
                  
                  {/* Barras de Despesas com gradiente */}
                  <Bar 
                    dataKey="despesas" 
                    fill="url(#colorDespesas)"
                    radius={[4, 4, 0, 0]}
                    name="Despesas"
                  />
                  
                  {/* Linha de saldo com pontos condicionais */}
                  <Line 
                    type="monotone" 
                    dataKey="saldo" 
                    stroke="hsl(var(--primary))"
                    strokeWidth={isMobile ? 2 : 3}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const saldo = payload?.saldo || 0;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isMobile ? 3 : 4}
                          fill={saldo >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{ 
                      r: isMobile ? 5 : 6, 
                      strokeWidth: 2,
                      fill: "hsl(var(--primary))",
                      stroke: "hsl(var(--background))"
                    }}
                    connectNulls={false}
                    name="Saldo Acumulado"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Indicadores visuais no mobile */}
            {isMobile && monthlyData.length > 0 && (
              <div className="flex justify-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-success"></div>
                  <span className="text-muted-foreground">Receitas</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-destructive"></div>
                  <span className="text-muted-foreground">Despesas</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-primary"></div>
                  <span className="text-muted-foreground">Saldo</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Details Table */}
      <Card className="financial-card">
        <CardHeader>
          <CardTitle className="text-sm sm:text-base">
            <span className="block sm:hidden">
              Detalhes - {filterType === "income" ? "Receitas" : filterType === "expense" ? "Despesas" : "Transações"}
            </span>
            <span className="hidden sm:block">
              Detalhes por Categoria - {filterType === "income" ? "Receitas" : filterType === "expense" ? "Despesas" : "Todas as Transações"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Nenhuma transação encontrada para o período selecionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-xs sm:text-sm">Categoria</th>
                    <th className="text-right py-2 text-xs sm:text-sm">Valor</th>
                    <th className="text-right py-2 text-xs sm:text-sm hidden sm:table-cell">%</th>
                    <th className="text-right py-2 text-xs sm:text-sm hidden md:table-cell">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.map((item, index) => (
                    <tr key={item.category} className="border-b last:border-b-0">
                      <td className="py-2 sm:py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div 
                            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.fill }}
                          />
                          <span className="text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                            {item.category}
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-2 sm:py-3 font-medium text-xs sm:text-sm">
                        <div className="flex flex-col sm:block">
                          <span>{formatCurrency(item.amount)}</span>
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {item.percentage.toFixed(1)}% • {item.transactions}x
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-2 sm:py-3 text-xs sm:text-sm hidden sm:table-cell">
                        {item.percentage.toFixed(1)}%
                      </td>
                      <td className="text-right py-2 sm:py-3 text-xs sm:text-sm hidden md:table-cell">
                        {item.transactions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}