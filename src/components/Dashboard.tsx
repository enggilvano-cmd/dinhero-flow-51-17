import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, TrendingUp, TrendingDown, CreditCard, DollarSign, CalendarIcon, Filter, ArrowRightLeft, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Clock, BarChart3 } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths, startOfDay, endOfDay, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useChartResponsive } from "@/hooks/useChartResponsive";
import { createDateFromString } from "@/lib/dateUtils";
import { 
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/ui/chart";
import { 
  formatCurrencyForAxis, 
  getBarChartAxisProps, 
  getLineChartProps, 
  getComposedChartMargins 
} from "@/lib/chartUtils";
import {
  Bar,
  Line,
  LineChart,
  ComposedChart,
  XAxis,
  YAxis,
  ResponsiveContainer
} from "recharts";

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  limit_amount?: number; // For credit cards
  color: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date | string;
  type: "income" | "expense" | "transfer";
  category_id: string;
  account_id: string;
  to_account_id?: string;
  status: "pending" | "completed";
}

interface Category {
  id: string;
  name: string;
  type: "income" | "expense" | "both";
  color: string;
}

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  onTransfer: () => void;
  onAddTransaction: () => void;
  onNavigateToAccounts?: (filterType?: "credit") => void;
  onNavigateToTransactions?: (
    filterType?: "income" | "expense", 
    filterStatus?: "all" | "pending" | "completed", 
    dateFilter?: "all" | "current_month" | "custom" | "month_picker", 
    filterAccountType?: "all" | "checking" | "savings" | "credit",
    selectedMonth?: Date,
    customStartDate?: Date,
    customEndDate?: Date
  ) => void;
}

export function Dashboard({ accounts, transactions, categories, onTransfer, onAddTransaction, onNavigateToAccounts, onNavigateToTransactions }: DashboardProps) {
  const { formatCurrency } = useSettings();
  const { chartConfig: responsiveConfig, isMobile } = useChartResponsive();
  
  // Estado dos filtros de data
  const [dateFilter, setDateFilter] = useState<"all" | "current_month" | "month_picker" | "custom">("current_month");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  
  // Estado para escala do gráfico
  const [chartScale, setChartScale] = useState<"daily" | "monthly">("monthly");
  
  // Estado para ano específico do gráfico
  const [chartYear, setChartYear] = useState<number>(new Date().getFullYear());

  // Função para filtrar transações por período
  const getFilteredTransactions = () => {
    let filtered = transactions;

    // Filtro por data
    if (dateFilter === "current_month") {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      filtered = filtered.filter(t => {
        const transactionDate = typeof t.date === 'string' ? createDateFromString(t.date) : t.date;
        return isWithinInterval(transactionDate, { start, end });
      });
    } else if (dateFilter === "month_picker") {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      filtered = filtered.filter(t => {
        const transactionDate = typeof t.date === 'string' ? createDateFromString(t.date) : t.date;
        return isWithinInterval(transactionDate, { start, end });
      });
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      filtered = filtered.filter(t => {
        const transactionDate = typeof t.date === 'string' ? createDateFromString(t.date) : t.date;
        return isWithinInterval(transactionDate, { 
          start: customStartDate, 
          end: customEndDate 
        });
      });
    }

    return filtered;
  };

  // Dados para o gráfico de evolução (diário ou mensal)
  const chartData = useMemo(() => {
    if (chartScale === "daily") {
      // Dados diários baseados no mês e ano selecionado na opção mensal
      let dailyFilteredTrans = transactions;
      
      // Filtrar pelo mês e ano da opção mensal quando em escala diária
      if (dateFilter === "current_month") {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        dailyFilteredTrans = transactions.filter(t => {
          const transactionDate = typeof t.date === 'string' ? createDateFromString(t.date) : t.date;
          return isWithinInterval(transactionDate, { start, end });
        });
      } else if (dateFilter === "month_picker") {
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);
        dailyFilteredTrans = transactions.filter(t => {
          const transactionDate = typeof t.date === 'string' ? createDateFromString(t.date) : t.date;
          return isWithinInterval(transactionDate, { start, end });
        });
      } else if (dateFilter === "custom" && customStartDate && customEndDate) {
        dailyFilteredTrans = transactions.filter(t => {
          const transactionDate = typeof t.date === 'string' ? createDateFromString(t.date) : t.date;
          return isWithinInterval(transactionDate, { 
            start: customStartDate, 
            end: customEndDate 
          });
        });
      }
      
      if (dailyFilteredTrans.length === 0) return [];
      
      const dailyTotals = dailyFilteredTrans.reduce((acc, transaction) => {
        const transactionDate = typeof transaction.date === 'string' ? createDateFromString(transaction.date) : transaction.date;
        const dateKey = format(transactionDate, 'yyyy-MM-dd');
        
        if (!acc[dateKey]) {
          acc[dateKey] = { income: 0, expenses: 0 };
        }
        
        if (transaction.type === 'income') {
          acc[dateKey].income += transaction.amount;
        } else if (transaction.type === 'expense') {
          acc[dateKey].expenses += transaction.amount;
        }
        
        return acc;
      }, {} as Record<string, { income: number; expenses: number }>);

      // Converter para array e ordenar
      const sortedEntries = Object.entries(dailyTotals)
        .sort(([a], [b]) => a.localeCompare(b));
      
      let saldoAcumulado = 0;
      const sortedDays = sortedEntries.map(([dateKey, data]) => {
        const saldoDaily = data.income - data.expenses;
        saldoAcumulado += saldoDaily;
        
        const [year, month, day] = dateKey.split('-').map(num => parseInt(num, 10));
        
        return {
          month: format(new Date(year, month - 1, day), 'dd/MM', { locale: ptBR }),
          receitas: data.income,
          despesas: data.expenses,
          saldo: saldoAcumulado,
          income: data.income,
          expenses: data.expenses,
          balance: saldoAcumulado
        };
      });

      return sortedDays;
    } else {
      // Dados mensais baseados no ano e mês específicos
      const monthlyTotals = transactions.reduce((acc, transaction) => {
        const transactionDate = typeof transaction.date === 'string' ? createDateFromString(transaction.date) : transaction.date;
        const transactionYear = transactionDate.getFullYear();
        const transactionMonth = transactionDate.getMonth() + 1;
        
        // Filtrar transações do ano específico
        if (transactionYear === chartYear) {
          const monthKey = format(transactionDate, 'yyyy-MM');
          
          if (!acc[monthKey]) {
            acc[monthKey] = { income: 0, expenses: 0 };
          }
          
          if (transaction.type === 'income') {
            acc[monthKey].income += transaction.amount;
          } else if (transaction.type === 'expense') {
            acc[monthKey].expenses += transaction.amount;
          }
        }
        
        return acc;
      }, {} as Record<string, { income: number; expenses: number }>);

      // Gerar todos os meses do ano selecionado
      const monthsToShow: string[] = [];
      
      // Sempre mostrar todos os 12 meses do ano selecionado
      for (let m = 1; m <= 12; m++) {
        const monthKey = `${chartYear}-${m.toString().padStart(2, '0')}`;
        monthsToShow.push(monthKey);
      }
      
      let saldoAcumulado = 0;
      const chartMonths = monthsToShow.map(monthKey => {
        const data = monthlyTotals[monthKey] || { income: 0, expenses: 0 };
        const saldoMensal = data.income - data.expenses;
        saldoAcumulado += saldoMensal;
        
        // Parse year and month from monthKey
        const [year, month] = monthKey.split('-').map(num => parseInt(num, 10));
        
        return {
          month: format(new Date(year, month - 1, 1), 'MMM', { locale: ptBR }),
          receitas: data.income,
          despesas: data.expenses,
          saldo: saldoAcumulado,
          income: data.income,
          expenses: data.expenses,
          balance: saldoAcumulado
        };
      });

      return chartMonths;
    }
  }, [transactions, chartScale, dateFilter, selectedMonth, customStartDate, customEndDate, chartYear]);

  // Dados mensais para o gráfico de evolução (manter para compatibilidade)
  const monthlyData = chartData;


  const filteredTransactions = getFilteredTransactions();
  
  const totalBalance = accounts
    .filter(acc => acc.type !== "credit")
    .reduce((sum, acc) => sum + acc.balance, 0);
     
  const creditAvailable = accounts
    .filter(acc => acc.type === "credit")
    .reduce((sum, acc) => {
      const limit = acc.limit_amount || 0;
      const used = Math.abs(acc.balance);
      return sum + (limit - used);
    }, 0);

  const periodIncome = filteredTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const periodExpenses = filteredTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  // Calcular gastos com cartões de crédito
  const creditCardExpenses = filteredTransactions
    .filter(t => {
      const account = accounts.find(acc => acc.id === t.account_id);
      return t.type === "expense" && account?.type === "credit";
    })
    .reduce((sum, t) => sum + t.amount, 0);

  // Cálculos para transações pendentes
  const pendingExpenses = filteredTransactions
    .filter(t => t.type === "expense" && t.status === "pending")
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingIncome = filteredTransactions
    .filter(t => t.type === "income" && t.status === "pending")
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingExpensesCount = filteredTransactions
    .filter(t => t.type === "expense" && t.status === "pending").length;

  const pendingIncomeCount = filteredTransactions
    .filter(t => t.type === "income" && t.status === "pending").length;

  const getPeriodLabel = () => {
    if (dateFilter === "all") {
      return "Todas as transações";
    } else if (dateFilter === "current_month") {
      return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else if (dateFilter === "month_picker") {
      return selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      return `${format(customStartDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(customEndDate, 'dd/MM/yyyy', { locale: ptBR })}`;
    }
    return "Período selecionado";
  };

  // Função para determinar o filtro de data para navegação
  const getNavigationParams = () => {
    if (dateFilter === "current_month") {
      return { dateFilter: "current_month" as const, selectedMonth: undefined, customStartDate: undefined, customEndDate: undefined };
    } else if (dateFilter === "month_picker") {
      return { dateFilter: "month_picker" as const, selectedMonth, customStartDate: undefined, customEndDate: undefined };
    } else if (dateFilter === "custom") {
      return { dateFilter: "custom" as const, selectedMonth: undefined, customStartDate, customEndDate };
    }
    return { dateFilter: "all" as const, selectedMonth: undefined, customStartDate: undefined, customEndDate: undefined };
  };

  // Funções para navegação de mês
  const goToPreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  return (
    <div className="space-y-3 sm:space-y-4 fade-in max-w-screen-2xl mx-auto px-2 sm:px-0">
      {/* Header ultra compacto */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">Painel</h1>
          <p className="text-sm text-muted-foreground leading-tight">
            Visão geral das suas finanças
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            onClick={onTransfer} 
            variant="outline" 
            size="sm"
            className="gap-1.5 h-8 flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Transferir</span>
            <span className="xs:hidden">Transfer</span>
          </Button>
          <Button 
            onClick={onAddTransaction} 
            size="sm"
            className="gap-1.5 h-8 flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Adicionar</span>
            <span className="xs:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Layout Otimizado - Cards em um único grid responsivo */}
      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4">
          {/* Card de Filtros */}
          <Card className="financial-card">
            <CardContent className="p-3">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Período</label>
                  <Select value={dateFilter} onValueChange={(value: "all" | "current_month" | "month_picker" | "custom") => setDateFilter(value)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="current_month">Mês Atual</SelectItem>
                      <SelectItem value="month_picker">Navegar por Mês</SelectItem>
                      <SelectItem value="custom">Período Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dateFilter === "month_picker" && (
                  <div>
                    <label className="text-xs font-medium mb-1 block">Mês</label>
                    <div className="flex items-center gap-1 h-8 px-2 border border-input rounded-md">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={goToPreviousMonth}
                        className="h-5 w-5 p-0"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="flex-1 text-center text-xs font-medium">
                        {format(selectedMonth, "MMM/yy", { locale: ptBR })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={goToNextMonth}
                        className="h-5 w-5 p-0"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {dateFilter === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Início</label>
                      <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full h-8 justify-start text-left font-normal text-xs",
                              !customStartDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            <span className="truncate">
                              {customStartDate ? format(customStartDate, "dd/MM", { locale: ptBR }) : "Inicial"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customStartDate}
                            onSelect={(date) => {
                              setCustomStartDate(date);
                              setStartDatePickerOpen(false);
                            }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <label className="text-xs font-medium mb-1 block">Fim</label>
                      <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full h-8 justify-start text-left font-normal text-xs",
                              !customEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            <span className="truncate">
                              {customEndDate ? format(customEndDate, "dd/MM", { locale: ptBR }) : "Final"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customEndDate}
                            onSelect={(date) => {
                              setCustomEndDate(date);
                              setEndDatePickerOpen(false);
                            }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Saldo Total */}
          <Card 
            className="financial-card cursor-pointer apple-interaction" 
            onClick={() => onNavigateToAccounts?.()}
          >
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Saldo Total</p>
              <div className={`text-base sm:text-lg font-bold leading-tight ${totalBalance >= 0 ? 'balance-positive' : 'balance-negative'}`}>
                {formatCurrency(totalBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 opacity-70">Contas e poupança</p>
            </CardContent>
          </Card>

          {/* Receitas */}
          <Card 
            className="financial-card cursor-pointer apple-interaction"
            onClick={() => {
              const params = getNavigationParams();
              onNavigateToTransactions?.("income", "all", params.dateFilter, "all", params.selectedMonth, params.customStartDate, params.customEndDate);
            }}
          >
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Receitas</p>
              <div className="text-base sm:text-lg font-bold balance-positive leading-tight">
                {formatCurrency(periodIncome)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 opacity-70">{getPeriodLabel()}</p>
            </CardContent>
          </Card>
          
          {/* Despesas */}
          <Card 
            className="financial-card cursor-pointer apple-interaction"
            onClick={() => {
              const params = getNavigationParams();
              onNavigateToTransactions?.("expense", "all", params.dateFilter, "all", params.selectedMonth, params.customStartDate, params.customEndDate);
            }}
          >
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Despesas</p>
              <div className="text-base sm:text-lg font-bold balance-negative leading-tight">
                {formatCurrency(periodExpenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 opacity-70">{getPeriodLabel()}</p>
            </CardContent>
          </Card>

          {/* Crédito Disponível */}
          <Card 
            className="financial-card cursor-pointer apple-interaction"
            onClick={() => onNavigateToAccounts?.("credit")}
          >
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Crédito Disponível</p>
              <div className="text-base sm:text-lg font-bold text-primary leading-tight">
                {formatCurrency(creditAvailable)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 opacity-70">Limite dos cartões</p>
            </CardContent>
          </Card>

          {/* Gastos com Cartão de Crédito */}
          <Card 
            className="financial-card cursor-pointer apple-interaction"
            onClick={() => {
              const params = getNavigationParams();
              onNavigateToTransactions?.("expense", "all", params.dateFilter, "credit", params.selectedMonth, params.customStartDate, params.customEndDate);
            }}
          >
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-warning/10 flex items-center justify-center">
                  <CreditCard className="h-3.5 w-3.5 text-warning" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Gastos Cartão</p>
              <div className="text-base sm:text-lg font-bold text-warning leading-tight">
                {formatCurrency(creditCardExpenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 opacity-70">{getPeriodLabel()}</p>
            </CardContent>
          </Card>

          {/* Receitas Pendentes */}
          <Card 
            className="financial-card cursor-pointer apple-interaction"
            onClick={() => {
              const params = getNavigationParams();
              onNavigateToTransactions?.("income", "pending", params.dateFilter, "all", params.selectedMonth, params.customStartDate, params.customEndDate);
            }}
          >
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-success" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Receitas Pendentes</p>
              <div className="text-base sm:text-lg font-bold text-success leading-tight">
                {formatCurrency(pendingIncome)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 opacity-70">{getPeriodLabel()}</p>
            </CardContent>
          </Card>

          {/* Despesas Pendentes */}
          <Card 
            className="financial-card cursor-pointer apple-interaction"
            onClick={() => {
              const params = getNavigationParams();
              onNavigateToTransactions?.("expense", "pending", params.dateFilter, "all", params.selectedMonth, params.customStartDate, params.customEndDate);
            }}
          >
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-destructive" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Despesas Pendentes</p>
              <div className="text-base sm:text-lg font-bold text-destructive leading-tight">
                {formatCurrency(pendingExpenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 opacity-70">{getPeriodLabel()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Evolução Mensal - Ocupa toda a linha */}
        {monthlyData.length > 0 && (
          <Card className="financial-card">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Evolução {chartScale === "daily" ? "Diária" : "Mensal"} - Receitas vs Despesas
                </CardTitle>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  {/* Controles de escala */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant={chartScale === "monthly" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setChartScale("monthly")}
                      className="h-7 px-2 text-xs"
                    >
                      <BarChart3 className="h-3 w-3 mr-1" />
                      Mensal
                    </Button>
                    <Button
                      variant={chartScale === "daily" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setChartScale("daily")}
                      className="h-7 px-2 text-xs"
                    >
                      <BarChart3 className="h-3 w-3 mr-1" />
                      Diário
                    </Button>
                  </div>
                  
                  {/* Controle de ano (apenas para escala mensal) */}
                  {chartScale === "monthly" && (
                    <Select value={chartYear.toString()} onValueChange={(value) => setChartYear(parseInt(value))}>
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="relative">
                {/* Empty state quando não há dados */}
                {monthlyData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] sm:h-[250px] text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm font-medium">Nenhum dado disponível</p>
                    <p className="text-xs opacity-70">
                      {chartScale === "daily" 
                        ? "Não há transações no período selecionado" 
                        : `Não há transações em ${chartYear}`
                      }
                    </p>
                  </div>
                ) : (
                  <ChartContainer 
                    config={{
                      receitas: {
                        label: "Receitas",
                        color: "hsl(var(--success))",
                      },
                      despesas: {
                        label: "Despesas", 
                        color: "hsl(var(--destructive))",
                      },
                      saldo: {
                        label: "Saldo Acumulado",
                        color: "hsl(var(--primary))",
                      }
                    }} 
                    className="h-[200px] sm:h-[300px] lg:h-[350px] w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart 
                        data={monthlyData} 
                        margin={{
                          top: 20,
                          right: isMobile ? 10 : 30,
                          left: isMobile ? 10 : 20,
                          bottom: isMobile ? 60 : 50
                        }}
                      >
                        {/* Grid lines */}
                        <defs>
                          <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                          </linearGradient>
                          <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                          </linearGradient>
                        </defs>

                        <XAxis 
                          dataKey="month" 
                          {...getBarChartAxisProps(responsiveConfig).xAxis}
                          interval={
                            chartScale === "daily" 
                              ? (isMobile 
                                  ? Math.max(0, Math.floor(monthlyData.length / 7)) 
                                  : Math.max(0, Math.floor(monthlyData.length / 15))
                                )
                              : 0
                          }
                          minTickGap={chartScale === "daily" ? (isMobile ? 15 : 8) : 5}
                          tickMargin={10}
                          angle={chartScale === "daily" ? (isMobile ? -45 : -30) : 0}
                          textAnchor={chartScale === "daily" ? "end" : "middle"}
                        />
                        
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ 
                            fontSize: isMobile ? 9 : 11,
                            fill: 'hsl(var(--muted-foreground))'
                          }}
                          tickFormatter={(value) => formatCurrencyForAxis(value, isMobile)}
                          width={isMobile ? 50 : 80}
                        />

                        <ChartTooltip 
                          content={<ChartTooltipContent 
                            className="bg-background/95 backdrop-blur-sm border border-border/50 shadow-lg"
                            labelClassName="font-medium text-foreground"
                            indicator="dot"
                          />}
                          formatter={(value: number, name: string) => [
                            formatCurrency(value), 
                            name === 'receitas' ? 'Receitas' : 
                            name === 'despesas' ? 'Despesas' : 
                            name === 'saldo' ? 'Saldo Acumulado' : name
                          ]}
                          labelFormatter={(label) => {
                            if (chartScale === "daily") {
                              return `Dia ${label}`;
                            }
                            return `Mês de ${label}`;
                          }}
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
                )}

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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards inferiores em grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Card className="financial-card cursor-pointer apple-interaction" onClick={() => onNavigateToAccounts?.()}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Suas Contas ({accounts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {accounts.length === 0 ? (
              <div className="text-center py-3 text-muted-foreground">
                <p className="text-xs">Nenhuma conta cadastrada</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransfer();
                  }}
                  className="mt-2 h-7 text-xs"
                >
                  Adicionar conta
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-1.5 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: account.color || "#6b7280" }}
                        >
                          <div className="text-xs font-semibold">
                            {account.type === "checking" && "C"}
                            {account.type === "savings" && "P"}
                            {account.type === "credit" && "R"}
                            {account.type === "investment" && "I"}
                          </div>
                        </div>
                        <p className="font-medium text-xs truncate">{account.name}</p>
                      </div>
                      <div className={`text-xs font-medium flex-shrink-0 ${
                        account.type === "credit" 
                          ? "balance-negative" 
                          : account.balance >= 0 ? "balance-positive" : "balance-negative"
                      }`}>
                        {formatCurrency(account.balance)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

          {/* Cards de Transações Recentes */}
          <Card className="financial-card cursor-pointer apple-interaction" onClick={() => onNavigateToTransactions?.()}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Transações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-3 text-muted-foreground">
                <p className="text-xs">Nenhuma transação encontrada</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTransaction();
                  }}
                  className="mt-2 h-7 text-xs"
                >
                  Adicionar primeira
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {filteredTransactions.slice(0, Math.max(accounts.length, 3)).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-1.5 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground opacity-70">
                          {(typeof transaction.date === 'string' ? createDateFromString(transaction.date) : transaction.date).toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: '2-digit' 
                          })}
                        </p>
                      </div>
                      <div className={`text-xs font-medium flex-shrink-0 ${
                        transaction.type === "income" ? "balance-positive" : 
                        transaction.type === "transfer" ? "text-muted-foreground" : "balance-negative"
                      }`}>
                        <div className="flex items-center gap-0.5">
                          <span className="text-xs opacity-60">
                            {transaction.type === "income" ? "+" : transaction.type === "transfer" ? "⇄" : "-"}
                          </span>
                          <span>{formatCurrency(transaction.amount)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredTransactions.length > Math.max(accounts.length, 3) && (
                  <p className="text-xs text-muted-foreground mt-2 text-center opacity-70">
                    +{filteredTransactions.length - Math.max(accounts.length, 3)} transações • Clique para ver todas
                  </p>
                )}
              </>
            )}
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}