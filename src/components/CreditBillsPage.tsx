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
import { Account, Transaction, CreditBill, Category } from "@/types"; // Importa tipos
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters"; // CORREÇÃO: Importar formatCurrency
import { cn } from "@/lib/utils";
// Precisamos das categorias para encontrar a de "Pagamento de Fatura"
import { useCategories } from "@/hooks/useCategories";
import { createDateFromString } from "@/lib/dateUtils";

export function CreditBillsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  // CORREÇÃO: Este estado agora armazena faturas REAIS do banco
  const [creditBills, setCreditBills] = useState<CreditBill[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<CreditBill | null>(null);
  const [loading, setLoading] = useState(true); // Estado de carregamento para a página

  // Date filter states
  const [dateFilter, setDateFilter] = useState<"all" | "current_month" | "month_picker" | "custom">("current_month"); // Filtro de período
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  
  const { toast } = useToast();
  // Hook para buscar categorias (necessário para o pagamento de fatura)
  const { categories, isLoading: categoriesLoading } = useCategories();

  useEffect(() => {
    loadData();
    
    // Configurar atualização automática (ex: a cada minuto)
    const interval = setInterval(() => {
      loadData();
    }, 60000); // 60 segundos
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");
      
      // 1. Load accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('name');

      if (accountsError) throw accountsError;
      
      // CORREÇÃO: Supabase retorna BIGINT como number (se dentro do safe integer) ou string.
      // Se já é number (em centavos), não precisa de parseFloat * 100.
      // Se é string (em centavos), Number() converte.
      const formattedAccounts = accountsData.map(acc => ({
        ...acc,
        balance: Number(acc.balance), // Assume que o DB já retorna em centavos
        limit_amount: acc.limit_amount ? Number(acc.limit_amount) : undefined
      }));
      setAccounts(formattedAccounts || []);

      // 2. CORREÇÃO: Buscar faturas da NOVA tabela 'credit_bills'
      const { data: billsData, error: billsError } = await supabase
        .from('credit_bills')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('due_date', { ascending: false });

      if (billsError) throw billsError;
      
      // Converte datas string para Date objects e valores para centavos
      const formattedBills = billsData.map(bill => ({
        ...bill,
        // Garante data local (o banco retorna 'YYYY-MM-DD')
        due_date: createDateFromString(bill.due_date),
        closing_date: createDateFromString(bill.closing_date),
        start_date: createDateFromString(bill.start_date), // Assume que o DB já retorna em centavos
        // CORREÇÃO: Valores já devem vir em centavos do DB, apenas converte para Number
        total_amount: Number(bill.total_amount),
        paid_amount: Number(bill.paid_amount),
        // A API de 'credit_bills' não retorna transações, 
        // o 'CreditBillDetailsModal' deve buscar se necessário.
        transactions: [] 
      }));
      
      setCreditBills(formattedBills);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar dados das faturas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: CreditBill['status'] | string) => {
    // Status pode vir do DB como 'closed', 'open', 'paid', 'partial'
    const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline", label: string, className: string }> = {
      open: { 
        variant: "secondary" as const, 
        label: "Aberta",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
      },
      closed: { 
        variant: "secondary" as const, 
        label: "Fechada",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" 
      },
      pending: { // Alias para 'closed'
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
    
    const config = variants[status] || variants.pending;
    
    return (
      <Badge 
        variant={config.variant}
        className={config.className}
      >
        {config.label}
      </Badge>
    );
  };


  const billsByStatus = creditBills.reduce((acc, bill) => {
    const statusKey = bill.status || 'pending';
    acc[statusKey] = (acc[statusKey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handlePayBill = (bill: CreditBill) => {
    const account = accounts.find(acc => acc.id === bill.account_id);
    if (account) {
      setSelectedBill(bill);
      setPaymentModalOpen(true);
    }
  };

  /**
   * CORREÇÃO CRÍTICA (LÓGICA CONTÁBIL):
   * Pagamento de fatura é uma TRANSFERÊNCIA, não uma Despesa + Receita.
   * Não atualizamos mais os saldos (o trigger SQL faz isso).
   */
  const handlePayment = async (creditAccountId: string, bankAccountId: string, amountInCents: number, date: Date): Promise<{ creditAccount: Account, bankAccount: Account }> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      // 1. Encontrar a categoria "Pagamento de Fatura"
      const paymentCategory = categories.find(c => c.name.toLowerCase() === 'pagamento de fatura' && (c.type === 'expense' || c.type === 'both'));
      if (!paymentCategory) {
        throw new Error("Categoria 'Pagamento de Fatura' não encontrada. Adicione-a nas Configurações.");
      }
      
      // 2. Criar UMA transação de TRANSFERÊNCIA
      // O valor da transferência é o `amountInCents`
      // O `amount` na tabela de transações para transferências é negativo (saindo da origem)
      const { error: transferError } = await supabase
        .from('transactions')
        .insert({
          user_id: userData.user.id,
          account_id: bankAccountId,      // De: Conta Bancária
          to_account_id: creditAccountId, // Para: Cartão de Crédito
          description: `Pagamento Fatura ${accounts.find(acc => acc.id === creditAccountId)?.name || ''}`, // CORREÇÃO: amount já está em centavos
          amount: -Math.abs(amountInCents),
          type: 'transfer',
          date: date.toISOString().split('T')[0],
          status: 'completed',
          category_id: paymentCategory.id
        });

      if (transferError) throw transferError;

      // 3. (Opcional) Atualizar o 'paid_amount' na tabela 'credit_bills' via RPC
      if (selectedBill) {
        const newPaidAmount = selectedBill.paid_amount + amountInCents;
        const newStatus = newPaidAmount >= selectedBill.total_amount ? 'paid' : 'partial';
        
        await supabase // CORREÇÃO: paid_amount já está em centavos
          .from('credit_bills')
          .update({ 
            paid_amount: newPaidAmount,
            status: newStatus
          })
          .eq('id', selectedBill.id);
      }

      toast({
        title: "Pagamento Realizado",
        description: `Pagamento de ${formatCurrency(amountInCents)} enviado com sucesso!`,
        variant: "default"
      });
      
      // Recarrega os dados para refletir o novo saldo (que o trigger atualizou)
      await loadData();
      setPaymentModalOpen(false);
      
      // 4. Retorna as contas atualizadas para o modal (como ele esperava)
      // Apenas buscamos os dados frescos do banco
      const { data: updatedAccountsData, error: updatedAccountsError } = await supabase
        .from('accounts')
        .select('*')
        .in('id', [creditAccountId, bankAccountId]);

      if (updatedAccountsError) throw updatedAccountsError;

      const updatedAccounts = updatedAccountsData.map(acc => ({ // CORREÇÃO: Valores já devem vir em centavos
        ...acc,
        balance: Number(acc.balance),
        limit_amount: acc.limit_amount ? Number(acc.limit_amount) : undefined
      }));

      const creditAccount = updatedAccounts.find(acc => acc.id === creditAccountId);
      const bankAccount = updatedAccounts.find(acc => acc.id === bankAccountId);

      if (!creditAccount || !bankAccount) {
        throw new Error("Não foi possível buscar contas atualizadas.");
      }
      
      return { creditAccount, bankAccount };

    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast({ title: "Erro", description: error.message || "Erro ao processar pagamento.", variant: "destructive" });
      throw error; // Propaga o erro para o modal
    }
  };

  // Filter bills by date - filters by due date
  const getFilteredBillsByDate = (bills: CreditBill[]) => {
    if (dateFilter === "all") {
      return bills;
    } else if (dateFilter === "current_month") {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return bills.filter(bill => isWithinInterval(bill.due_date, { start, end }));
    } else if (dateFilter === "month_picker") {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      return bills.filter(bill => isWithinInterval(bill.due_date, { start, end }));
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
    const filtered = bills.filter(bill => {
      const accountMatches = selectedAccount === "all" || bill.account_id === selectedAccount;
      // Mapeia 'closed' para 'pending' (na UI)
      let billStatus = bill.status;
      if (billStatus === 'closed') billStatus = 'pending';
      
      const statusMatches = selectedStatus === "all" || billStatus === selectedStatus;
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

  const creditAccounts = accounts.filter(acc => acc.type === 'credit');
  const totalPending = filteredBills
    .filter(bill => bill.status === "closed" || bill.status === "pending" || bill.status === "overdue")
    .reduce((sum, bill) => sum + (bill.total_amount - bill.paid_amount), 0); // Mostra o que falta pagar

  if (loading || categoriesLoading) {
    return (
      <div className="container-responsive space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-financial-h1">Faturas de Cartão</h1>
            <p className="text-financial-secondary">
              Gerencie suas faturas de cartão de crédito
            </p>
          </div>
        </div>
        {/* Loading Skeleton */}
        <div className="space-y-6 animate-pulse">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted rounded-lg"></div>
            ))}
          </div>
          <div className="h-40 bg-muted rounded-lg"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
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
                  {filteredBills.filter(b => b.status === "closed" || b.status === "pending" || b.status === "overdue").length} faturas
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
                  {filteredBills.filter(b => b.status === "open").length}
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
                <p className="text-financial-caption text-muted-foreground">Vencendo este Mês</p>
                <div className="text-financial-value truncate">
                  {filteredBills.filter(b => {
                    const currentMonth = new Date().getMonth();
                    return b.due_date.getMonth() === currentMonth;
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
                <label className="text-financial-caption text-muted-foreground">Período Vencimento</label>
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
                    <SelectItem value="open">Aberta</SelectItem>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4">
                {filteredBills.map((bill) => {
                  const account = accounts.find(acc => acc.id === bill.account_id);
                  const isOverdue = bill.status === "overdue";
                  const billingCycle = `${format(bill.start_date, 'dd/MM')} - ${format(bill.closing_date, 'dd/MM')}`;
                    
                  return (
                    <div 
                      key={bill.id} 
                      className={cn(
                        "apple-card p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 flex flex-col",
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
                            <p className="text-financial-caption text-muted-foreground">{billingCycle}</p>
                          </div>
                        </div>
                        {getStatusBadge(bill.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4 flex-grow">
                        <div>
                          <p className="text-financial-caption text-muted-foreground mb-1">Vencimento</p>
                          <p className="text-financial-body font-medium">{formatDate(bill.due_date)}</p>
                        </div>
                        <div>
                          <p className="text-financial-caption text-muted-foreground mb-1">Total</p>
                          <p className="text-financial-value text-sm font-bold">{formatCurrency(bill.total_amount)}</p>
                        </div>
                        {bill.paid_amount > 0 && (bill.status === "partial" || bill.status === "paid") && (
                          <div className="col-span-2">
                            <p className="text-financial-caption text-muted-foreground mb-1">Valor Pago</p>
                            <p className="text-financial-body text-success font-medium">{formatCurrency(bill.paid_amount)}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 mt-auto">
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
                        {bill.status !== "paid" && bill.status !== "open" && (bill.total_amount - bill.paid_amount > 0) && (
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
          // accounts={accounts} // O modal agora usa o useAccountStore
          creditAccount={selectedBill ? accounts.find(acc => acc.id === selectedBill.account_id) : null}
          // Passa o valor *restante* da fatura, não o total
          invoiceValueInCents={selectedBill.total_amount - selectedBill.paid_amount}
          nextInvoiceValueInCents={
            creditBills.find(b => 
              b.account_id === selectedBill.account_id &&
              b.status === 'open'
            )?.total_amount || 0
          }
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