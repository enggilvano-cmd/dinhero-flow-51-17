import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar as CalendarIcon,
  Search,
  Loader2 // Importar um ícone de loading
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
  getBarChartAxisProps,
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
  ComposedChart
} from "recharts";
import { exportToCSV, exportToPDF } from "@/lib/reports";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Tipos para os dados vindos da RPC
interface ReportTotals {
  income: number;
  expenses: number;
}
interface ReportCategoryData {
  category: string;
  amount: number;
  transactions: number;
  fill: string;
  percentage: number;
}
interface ReportMonthlyData {
  month_key: string;
  month: string;
  income: number;
  expenses: number;
  balance: number;
}
interface AnalyticsReport {
  totals: ReportTotals;
  categories: ReportCategoryData[];
  monthly: ReportMonthlyData[];
}

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  color: string;
}

interface AnalyticsPageProps {
  // Removido 'transactions', não é mais necessário aqui
  accounts: Account[];
}

export default function AnalyticsPage({ accounts }: AnalyticsPageProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { chartConfig: responsiveConfig, isMobile } = useChartResponsive();
  
  // Estado para os filtros
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  // Estado para os dados do relatório
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // MELHORIA DE EXCELÊNCIA (P2): Hook para buscar dados da RPC
  useEffect(() => {
    const fetchReport = async () => {
      if (!user || !customStartDate || !customEndDate) return;

      setIsLoading(true);
      setReport(null); // Limpa o relatório antigo

      const { data, error } = await supabase.rpc('get_analytics_report', {
        p_user_id: user.id,
        p_start_date: customStartDate.toISOString(),
        p_end_date: customEndDate.toISOString()
      });

      if (error) {
        console.error("Error fetching analytics report:", error);
        toast({
          title: "Erro ao buscar relatório",
          description: "Não foi possível carregar os dados de análise. Tente novamente.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Acumula o saldo para o gráfico mensal
      let saldoAcumulado = 0;
      const processedMonthlyData = data.monthly.map((month: any) => {
        saldoAcumulado += month.balance; // 'balance' aqui é o saldo mensal
        return {
          ...month,
          saldo: saldoAcumulado // Sobrescreve com o saldo acumulado
        };
      });

      setReport({ ...data, monthly: processedMonthlyData });
      setIsLoading(false);
    };

    fetchReport();
  }, [user, customStartDate, customEndDate, toast]);

  // Os dados agora são derivados do estado 'report'
  const totalsByType = report?.totals || { income: 0, expenses: 0 };
  const categoryData = report?.categories || [];
  const monthlyData = report?.monthly || [];

  // Configs do gráfico de saldos de conta (continua no frontend)
  const accountBalanceData = useMemo(() => {
    return accounts
      .filter(acc => acc.type !== "credit")
      .map(account => ({
        name: account.name.split(" - ")[0] || account.name,
        balance: account.balance,
        color: account.color || "hsl(var(--primary))"
      }));
  }, [accounts]);

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


  // Configs dos gráficos de relatório
  const chartConfig = {
    receitas: { label: "Receitas", color: "hsl(var(--success))" },
    despesas: { label: "Despesas", color: "hsl(var(--destructive))" },
    saldo: { label: "Saldo", color: "hsl(var(--primary))" }
  };

  const categoryChartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    categoryData.forEach(item => {
      config[item.category] = {
        label: item.category,
        color: item.fill
      };
    });
    return config;
  }, [categoryData]);

  // ... (Funções de exportação handleExportCSV, handleExportPDF) ...
  // (Elas continuam funcionando, pois 'categoryData' tem o mesmo formato)

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
        {/* ... (Botões de Exportar) ... */}
      </div>

      {/* Filters */}
      <Card className="financial-card">
        <CardHeader>
          <CardTitle className="text-headline">
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="spacing-responsive-sm">
          {/* MELHORIA (P2): Filtros simplificados para data. Outros filtros (categoria, conta)
              podem ser adicionados como parâmetros para a RPC no futuro. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              {isLoading && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium">Receitas no Período</p>
                <div className="text-responsive-xl font-bold balance-positive leading-tight">
                  {formatCurrency(totalsByType.income)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium">Despesas no Período</p>
                <div className="text-responsive-xl font-bold balance-negative leading-tight">
                  {formatCurrency(totalsByType.expenses)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium">Saldo Líquido no Período</p>
                <div className={`text-responsive-xl font-bold leading-tight ${
                  (totalsByType.income - totalsByType.expenses) >= 0 ? "balance-positive" : "balance-negative"
                }`}>
                  {formatCurrency(totalsByType.income - totalsByType.expenses)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Análise (Pizza e Evolução) */}
      <Card className="financial-card">
         <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <PieChart className="h-4 w-4 sm:h-5 sm:w-5" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            {isLoading ? (
              <div className="flex justify-center items-center h-[350px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : categoryData.length === 0 ? (
               <div className="text-center text-muted-foreground py-8 h-[350px] flex-col flex justify-center items-center">
                <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Nenhuma despesa encontrada para o período selecionado</p>
              </div>
            ) : (
            <ChartContainer
              config={categoryChartConfig}
              className={`${responsiveConfig.containerHeight} w-full overflow-hidden`}
            >
              <RechartsPieChart>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                />
                <Pie
                  data={categoryData.map(item => ({...item, name: item.category}))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={responsiveConfig.showLabels && categoryData.length <= 6
                    ? ({ name, percentage }: any) => `${name}: ${percentage.toFixed(1)}%`
                    : false
                  }
                  outerRadius={responsiveConfig.outerRadius}
                  dataKey="amount"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                {responsiveConfig.showLegend && (
                  <ChartLegend
                    content={<ChartLegendContent />}
                    wrapperStyle={{ paddingTop: responsiveConfig.showLabels ? '10px' : '20px' }}
                    iconType="circle"
                  />
                )}
              </RechartsPieChart>
            </ChartContainer>
            )}
          </CardContent>
      </Card>
      
      <Card className="financial-card">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              Evolução Mensal - Receitas vs Despesas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            {isLoading ? (
               <div className="flex justify-center items-center h-[350px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : monthlyData.length === 0 ? (
               <div className="text-center text-muted-foreground py-8 h-[350px] flex-col flex justify-center items-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Nenhum dado mensal encontrado para o período</p>
              </div>
            ) : (
            <ChartContainer config={chartConfig} className={`${responsiveConfig.containerHeight} w-full overflow-hidden`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={getComposedChartMargins(responsiveConfig)}>
                  {/* ... (defs de gradiente) ... */}
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
                      name === 'income' ? 'Receitas' :
                      name === 'expenses' ? 'Despesas' :
                      name === 'saldo' ? 'Saldo Acumulado' : name
                    ]}
                    labelFormatter={(label) => `Mês de ${label}`}
                  />
                  {!isMobile && (
                    <ChartLegend
                      content={<ChartLegendContent className="flex justify-center gap-6" />}
                      verticalAlign="top"
                    />
                  )}
                  <Bar dataKey="income" fill="url(#colorReceitas)" radius={[4, 4, 0, 0]} name="Receitas" />
                  <Bar dataKey="expenses" fill="url(#colorDespesas)" radius={[4, 4, 0, 0]} name="Despesas" />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="hsl(var(--primary))"
                    strokeWidth={isMobile ? 2 : 3}
                    dot={false}
                    name="Saldo Acumulado"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
            )}
          </CardContent>
      </Card>
      
      {/* Gráfico de Saldos de Conta (Permanece igual) */}
      <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              Saldos Atuais por Conta
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
        
      {/* Tabela de Detalhes (pode ser alimentada por report.categories) */}
      {/* ... (O componente da tabela pode ser mantido, usando 'categoryData' como fonte) ... */}
    </div>
  );
}