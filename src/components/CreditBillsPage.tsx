import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, CreditCard, DollarSign, Plus, Receipt, Filter, Eye, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CreditPaymentModal } from "./CreditPaymentModal";
import { CreditBillDetailsModal } from "./CreditBillDetailsModal";
import { useToast } from "@/hooks/use-toast";
import { Account, Transaction, CreditBill } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function CreditBillsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creditBills, setCreditBills] = useState<CreditBill[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<CreditBill | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Date filter states
  const [dateFilter, setDateFilter] = useState<"all" | "current_month" | "month_picker" | "custom">("current_month");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    
    // Configurar atualização automática a cada 60 segundos
    const interval = setInterval(() => {
      loadData();
    }, 60000); // 60 segundos
    
    // Limpar o intervalo quando o componente for desmontado
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .order('name');

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      // Load transactions for credit cards to generate bills
      const creditAccounts = (accountsData || []).filter(acc => acc.type === 'credit');
      
      // Generate mock bills for demonstration (in real app, this would come from backend)
      const bills = await generateCreditBills(creditAccounts);
      setCreditBills(bills);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados das faturas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCreditBills = async (creditAccounts: Account[]): Promise<CreditBill[]> => {
    const bills: CreditBill[] = [];
    
    // Get transactions for all credit accounts
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return bills;

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userData.user.id)
      .in('account_id', creditAccounts.map(acc => acc.id))
      .order('date', { ascending: false });

    for (const account of creditAccounts) {
      const today = new Date();
      const closingDay = account.closing_date || 21;
      const dueDay = account.due_date || 30;
      
      // Get account transactions
      const accountTransactions = transactions?.filter(t => t.account_id === account.id) || [];
      
      // Generate bills for the last 12 months and next 3 months to show all past and future bills
      const pastMonths = 12;
      const futureMonths = 3;
      const generatedBills = new Map<string, CreditBill>();
      
      for (let i = -pastMonths; i <= futureMonths; i++) {
        const billMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const closingDate = new Date(billMonth.getFullYear(), billMonth.getMonth(), closingDay);
        const dueDate = new Date(billMonth.getFullYear(), billMonth.getMonth(), dueDay);
        
        // If due day is before closing day, due date is next month
        if (dueDay < closingDay) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }
        
        // Calculate period for transactions (from day after previous closing to current closing)
        // Para fatura fechando em 21/05, o período deve ser de 22/04 a 21/05
        const previousClosingDate = new Date(closingDate);
        previousClosingDate.setMonth(previousClosingDate.getMonth() - 1);
        
        const periodStart = new Date(previousClosingDate);
        periodStart.setDate(periodStart.getDate() + 1); // Dia seguinte ao fechamento anterior
        
        // Find transactions in this billing period
        const periodTransactions = accountTransactions.filter(t => {
          const transactionDate = new Date(t.date + 'T00:00:00');
          return transactionDate >= periodStart && transactionDate <= closingDate;
        });
        
        // Calculate bill amounts
        const expenseTransactions = periodTransactions.filter(t => t.type === 'expense');
        const totalAmount = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        // Create bill for all periods to show complete history (both open and closed bills)
        const billingCycle = `${(closingDate.getMonth() + 1).toString().padStart(2, '0')}/${closingDate.getFullYear()}`;
        
        // For future bills, check if closing date hasn't passed yet
        const isFutureBill = i > 0 || (i === 0 && today < closingDate);
        
        // Only skip very old periods without any transactions at all
        const hasAnyTransactions = accountTransactions.some(t => {
          const transactionDate = new Date(t.date + 'T00:00:00');
          const billMonthStart = new Date(closingDate.getFullYear(), closingDate.getMonth() - 1, 1);
          const billMonthEnd = new Date(closingDate.getFullYear(), closingDate.getMonth() + 1, 0);
          return transactionDate >= billMonthStart && transactionDate <= billMonthEnd;
        });
        
        // Include future bills, current period, or periods with transactions
        if (isFutureBill || hasAnyTransactions || totalAmount > 0 || i >= -3) {
          
          console.log(`Período da fatura ${billingCycle}:`, {
            fechamentoPrevio: previousClosingDate.toLocaleDateString('pt-BR'),
            inicioPeríodo: periodStart.toLocaleDateString('pt-BR'),
            fechamentoAtual: closingDate.toLocaleDateString('pt-BR'),
            transacoesEncontradas: periodTransactions.length
          });
          
          // Calculate payments - buscar pagamentos após a data de fechamento até hoje
          const paymentStartDate = new Date(closingDate);
          paymentStartDate.setDate(paymentStartDate.getDate() + 1);
          
          const paymentsAfterClosing = accountTransactions.filter(t => {
            const transactionDate = new Date(t.date + 'T00:00:00');
            return t.type === 'income' && 
                   transactionDate > closingDate && 
                   transactionDate <= today &&
                   t.description.toLowerCase().includes('pagamento');
          });
          
          const paidAmount = paymentsAfterClosing.reduce((sum, t) => sum + t.amount, 0);
          
          // Determine status based on current situation
          let status: CreditBill['status'] = "pending";
          
          if (isFutureBill) {
            // Future bills are always pending until they close
            status = "pending";
          } else if (totalAmount === 0) {
            status = "paid"; // No expenses in this period
          } else if (paidAmount >= totalAmount) {
            status = "paid"; // Fully paid
          } else if (paidAmount > 0) {
            status = "partial"; // Partially paid
          } else if (today > dueDate) {
            status = "overdue"; // Not paid and overdue
          } else {
            status = "pending"; // Not paid but not overdue yet
          }
          
          const bill: CreditBill = {
            id: `bill-${account.id}-${closingDate.getTime()}`,
            account_id: account.id,
            billing_cycle: billingCycle,
            due_date: dueDate,
            closing_date: closingDate,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            status,
            minimum_payment: totalAmount * 0.15,
            late_fee: status === "overdue" ? totalAmount * 0.02 : 0,
            transactions: periodTransactions
          };
          
          generatedBills.set(billingCycle, bill);
        }
      }
      
      // Add all generated bills to the array
      bills.push(...Array.from(generatedBills.values()));
    }
    
    return bills.sort((a, b) => b.due_date.getTime() - a.due_date.getTime());
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const getStatusBadge = (status: CreditBill['status']) => {
    const variants = {
      pending: { 
        variant: "secondary" as const, 
        label: "Pendente",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" 
      },
      paid: { 
        variant: "default" as const, 
        label: "Paga",
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
      },
      overdue: { 
        variant: "destructive" as const, 
        label: "Vencida",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" 
      },
      partial: { 
        variant: "outline" as const, 
        label: "Parcial",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
      }
    };
    
    return (
      <Badge 
        variant={variants[status].variant}
        className={variants[status].className}
      >
        {variants[status].label}
      </Badge>
    );
  };


  // Count bills by status for summary
  const billsByStatus = creditBills.reduce((acc, bill) => {
    acc[bill.status] = (acc[bill.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handlePayBill = (bill: CreditBill) => {
    const account = accounts.find(acc => acc.id === bill.account_id);
    if (account) {
      setSelectedBill(bill);
      setPaymentModalOpen(true);
    }
  };

  const handlePayment = async (creditAccountId: string, bankAccountId: string, amount: number, date: Date) => {
    try {
      // Create payment transaction in database
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      // Insert debit transaction for bank account
      const { error: debitError } = await supabase
        .from('transactions')
        .insert({
          user_id: userData.user.id,
          account_id: bankAccountId,
          description: `Pagamento fatura cartão ${accounts.find(acc => acc.id === creditAccountId)?.name || 'Cartão'}`,
          amount: -amount,
          type: 'expense',
          date: date.toISOString().split('T')[0],
          status: 'completed'
        });

      if (debitError) throw debitError;

      // Insert credit transaction for credit card
      const { error: creditError } = await supabase
        .from('transactions')
        .insert({
          user_id: userData.user.id,
          account_id: creditAccountId,
          description: `Pagamento fatura ${formatCurrency(amount)} recebido`,
          amount: amount,
          type: 'income',
          date: date.toISOString().split('T')[0],
          status: 'completed'
        });

      if (creditError) throw creditError;

      // Update account balances
      const bankAccount = accounts.find(acc => acc.id === bankAccountId);
      const creditAccount = accounts.find(acc => acc.id === creditAccountId);

      if (bankAccount) {
        await supabase
          .from('accounts')
          .update({ balance: bankAccount.balance - amount })
          .eq('id', bankAccountId);
      }

      if (creditAccount) {
        await supabase
          .from('accounts')
          .update({ balance: creditAccount.balance + amount })
          .eq('id', creditAccountId);
      }

      toast({
        title: "Pagamento Realizado",
        description: `Pagamento de ${formatCurrency(amount)} realizado com sucesso!`,
        variant: "default"
      });
      
      // Reload data to reflect changes
      await loadData();
      setPaymentModalOpen(false);
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar pagamento.",
        variant: "destructive"
      });
    }
  };

  // Filter bills by date - now filters by due date only (not closing date)
  const getFilteredBillsByDate = (bills: CreditBill[]) => {
    if (dateFilter === "all") {
      return bills;
    } else if (dateFilter === "current_month") {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return bills.filter(bill => {
        return isWithinInterval(bill.due_date, { start, end });
      });
    } else if (dateFilter === "month_picker") {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      return bills.filter(bill => {
        return isWithinInterval(bill.due_date, { start, end });
      });
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      return bills.filter(bill => {
        return bill.due_date >= customStartDate && bill.due_date <= customEndDate;
      });
    }
    return bills;
  };

  const filteredBills = useMemo(() => {
    let bills = creditBills;
    
    // Apply date filter first
    bills = getFilteredBillsByDate(bills);
    
    // Apply account and status filters
    const accountMatch = selectedAccount === "all" || bills.filter(bill => bill.account_id === selectedAccount);
    const filtered = bills.filter(bill => {
      const accountMatches = selectedAccount === "all" || bill.account_id === selectedAccount;
      const statusMatches = selectedStatus === "all" || bill.status === selectedStatus;
      return accountMatches && statusMatches;
    });
    
    return filtered;
  }, [creditBills, dateFilter, selectedMonth, customStartDate, customEndDate, selectedAccount, selectedStatus]);

  // Navigation functions for month picker
  const goToPreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  const getPeriodLabel = () => {
    if (dateFilter === "all") {
      return "Todas as faturas";
    } else if (dateFilter === "current_month") {
      return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else if (dateFilter === "month_picker") {
      return selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      return `${format(customStartDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(customEndDate, 'dd/MM/yyyy', { locale: ptBR })}`;
    }
    return "Período selecionado";
  };

  const creditAccounts = accounts.filter(acc => acc.type === 'credit');
  const totalPending = filteredBills
    .filter(bill => bill.status === "pending" || bill.status === "overdue")
    .reduce((sum, bill) => sum + bill.total_amount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded-md w-48 mb-4"></div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-responsive space-y-4">
      {/* Header - Compacto e responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-financial-h1">Faturas de Cartão</h1>
          <p className="text-financial-secondary">
            Gerencie suas faturas de cartão de crédito
          </p>
        </div>
      </div>

      {/* Layout Responsivo Principal */}
      <div className="space-y-4">
        {/* Cards de Resumo - Layout Totalmente Responsivo */}
        <div className="grid gap-3 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
          <Card className="financial-card">
            <div className="flex items-center justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-financial-caption text-muted-foreground">Total Pendente</p>
                <div className="text-financial-value text-destructive truncate">
                  {formatCurrency(totalPending)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredBills.filter(b => b.status === "pending" || b.status === "overdue").length} faturas
                </p>
              </div>
              <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>

          <Card className="financial-card">
            <div className="flex items-center justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-financial-caption text-muted-foreground">Próximas Abertas</p>
                <div className="text-financial-value text-primary truncate">
                  {filteredBills.filter(b => {
                    const today = new Date();
                    return b.closing_date > today && b.status === "pending";
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">Faturas futuras</p>
              </div>
              <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>

          <Card className="financial-card">
            <div className="flex items-center justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-financial-caption text-muted-foreground">Cartões Ativos</p>
                <div className="text-financial-value truncate">{creditAccounts.length}</div>
                <p className="text-xs text-muted-foreground">Cartões cadastrados</p>
              </div>
              <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>

          <Card className="financial-card">
            <div className="flex items-center justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-financial-caption text-muted-foreground">Este Mês</p>
                <div className="text-financial-value truncate">
                  {filteredBills.filter(b => {
                    const currentMonth = new Date().getMonth() + 1;
                    const billMonth = parseInt(b.billing_cycle.split('/')[0]);
                    return billMonth === currentMonth;
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">Faturas do mês</p>
              </div>
              <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>
        </div>

        {/* Filtros - Layout Responsivo Compacto */}
        <Card className="financial-card">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-financial-button font-medium">Filtros</span>
            </div>
            
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              {/* Period Filter */}
              <div className="space-y-2">
                <label className="text-financial-caption text-muted-foreground">Período</label>
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

                {dateFilter === "month_picker" && (
                  <div className="flex items-center gap-1 h-8 px-2 border border-input rounded-md bg-background">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goToPreviousMonth}
                      className="h-4 w-4 p-0 hover:bg-muted"
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
                      className="h-4 w-4 p-0 hover:bg-muted"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {dateFilter === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Início</label>
                      <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full h-7 justify-start text-left font-normal text-xs px-2",
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
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                      <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full h-7 justify-start text-left font-normal text-xs px-2",
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
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </div>

              {/* Account Filter */}
              <div className="space-y-2">
                <label className="text-financial-caption text-muted-foreground">Cartão</label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos os cartões" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cartões</SelectItem>
                    {creditAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: account.color || "#6b7280" }}
                          />
                          <span className="truncate">{account.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-financial-caption text-muted-foreground">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Paga</SelectItem>
                    <SelectItem value="overdue">Vencida</SelectItem>
                    <SelectItem value="partial">Parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quick Stats */}
              <div className="space-y-2 sm:col-span-1 xl:col-span-1">
                <label className="text-financial-caption text-muted-foreground">Resultados</label>
                <div className="h-8 flex items-center px-2 bg-muted/50 rounded-md">
                  <span className="text-xs font-medium">{filteredBills.length} de {creditBills.length}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Lista de Faturas - Layout Completamente Responsivo */}
        <Card className="financial-card overflow-hidden">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-financial-h3">Faturas</CardTitle>
              <div className="flex items-center gap-2 text-financial-secondary">
                <span>{filteredBills.length} de {creditBills.length} faturas</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredBills.length === 0 ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <CreditCard className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-financial-h3 mb-2">Nenhuma fatura encontrada</h3>
                <p className="text-financial-secondary max-w-md mx-auto">
                  {creditAccounts.length === 0 
                    ? "Cadastre um cartão de crédito para visualizar as faturas."
                    : "Nenhuma fatura corresponde aos filtros selecionados."
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Mobile e Tablet: Lista de Cards Otimizada */}
                <div className="xl:hidden space-y-3 p-3 sm:p-4">
                  {filteredBills.map((bill) => {
                    const account = accounts.find(acc => acc.id === bill.account_id);
                    const isOverdue = bill.status === "overdue";
                      
                    return (
                      <div 
                        key={bill.id} 
                        className={cn(
                          "apple-card p-3 sm:p-4 rounded-lg border-2 transition-all duration-200",
                          isOverdue 
                            ? "border-destructive/30 bg-destructive/5 shadow-sm" 
                            : "border-border/50 hover:border-primary/20 hover:shadow-md"
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div 
                              className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: account?.color || "#6b7280" }}
                            />
                            <div className="min-w-0">
                              <h4 className="text-financial-button truncate">{account?.name}</h4>
                              <p className="text-financial-caption text-muted-foreground">{bill.billing_cycle}</p>
                            </div>
                          </div>
                          {getStatusBadge(bill.status)}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div>
                            <p className="text-financial-caption text-muted-foreground mb-1">Vencimento</p>
                            <p className="text-financial-body font-medium">{formatDate(bill.due_date)}</p>
                          </div>
                          <div>
                            <p className="text-financial-caption text-muted-foreground mb-1">Total</p>
                            <p className="text-financial-value text-sm font-bold">{formatCurrency(bill.total_amount)}</p>
                          </div>
                          {bill.paid_amount > 0 && bill.status === "partial" && (
                            <>
                              <div className="col-span-2">
                                <p className="text-financial-caption text-muted-foreground mb-1">Pago</p>
                                <p className="text-financial-body text-success font-medium">{formatCurrency(bill.paid_amount)}</p>
                              </div>
                            </>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedBill(bill);
                              setDetailsModalOpen(true);
                            }}
                            className="flex-1 h-8 text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                          {bill.status !== "paid" && (
                            <Button 
                              size="sm" 
                              onClick={() => handlePayBill(bill)}
                              className="flex-1 h-8 text-xs"
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              Pagar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: Tabela Otimizada */}
                <div className="hidden xl:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-border/50">
                        <TableHead className="w-[180px] text-financial-caption">Cartão</TableHead>
                        <TableHead className="w-[90px] text-financial-caption">Período</TableHead>
                        <TableHead className="w-[110px] text-financial-caption">Vencimento</TableHead>
                        <TableHead className="w-[130px] text-financial-caption">Total</TableHead>
                        <TableHead className="w-[100px] text-financial-caption">Status</TableHead>
                        <TableHead className="w-[120px] text-right text-financial-caption">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBills.map((bill) => {
                        const account = accounts.find(acc => acc.id === bill.account_id);
                        const isOverdue = bill.status === "overdue";
                        
                        return (
                          <TableRow 
                            key={bill.id} 
                            className={cn(
                              "hover:bg-muted/30 transition-colors",
                              isOverdue && "bg-destructive/5 hover:bg-destructive/10"
                            )}
                          >
                            <TableCell className="py-3">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: account?.color || "#6b7280" }}
                                />
                                <span className="text-financial-body font-medium truncate">{account?.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-financial-body py-3">{bill.billing_cycle}</TableCell>
                            <TableCell className="text-financial-body py-3">{formatDate(bill.due_date)}</TableCell>
                            <TableCell className="py-3">
                              <div className="text-financial-value text-sm font-semibold">{formatCurrency(bill.total_amount)}</div>
                              {bill.paid_amount > 0 && bill.status === "partial" && (
                                <div className="text-xs text-success font-medium">
                                  Pago: {formatCurrency(bill.paid_amount)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-3">{getStatusBadge(bill.status)}</TableCell>
                            <TableCell className="text-right py-3">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedBill(bill);
                                    setDetailsModalOpen(true);
                                  }}
                                  className="h-7 w-7 p-0"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                {bill.status !== "paid" && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handlePayBill(bill)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <DollarSign className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Modal */}
      {selectedBill && (
        <CreditPaymentModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          onPayment={handlePayment}
          accounts={accounts}
          creditAccount={accounts.find(acc => acc.id === selectedBill.account_id) || null}
        />
      )}

      {/* Bill Details Modal */}
      <CreditBillDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        bill={selectedBill}
        account={selectedBill ? accounts.find(acc => acc.id === selectedBill.account_id) : null}
        onPayBill={(bill) => {
          setDetailsModalOpen(false);
          handlePayBill(bill);
        }}
      />
    </div>
  );
}