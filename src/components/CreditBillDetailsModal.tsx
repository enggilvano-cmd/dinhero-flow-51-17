import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Download, DollarSign, CreditCard, AlertTriangle } from "lucide-react";
import { CreditBill, Account } from "@/types";
import { createDateFromString } from "@/lib/dateUtils";

interface CreditBillDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: CreditBill | null;
  account: Account | null;
  onPayBill?: (bill: CreditBill) => void;
}

export function CreditBillDetailsModal({ 
  open, 
  onOpenChange, 
  bill, 
  account, 
  onPayBill 
}: CreditBillDetailsModalProps) {
  if (!bill || !account) return null;

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
      pending: { variant: "secondary" as const, label: "Pendente", color: "text-yellow-600" },
      paid: { variant: "default" as const, label: "Paga", color: "text-green-600" },
      overdue: { variant: "destructive" as const, label: "Vencida", color: "text-red-600" },
      partial: { variant: "outline" as const, label: "Parcial", color: "text-blue-600" }
    };
    
    return (
      <Badge variant={variants[status].variant} className={variants[status].color}>
        {variants[status].label}
      </Badge>
    );
  };

  const isOverdue = bill.status === "overdue";
  const remainingAmount = bill.total_amount - bill.paid_amount;
  const paymentProgress = (bill.paid_amount / bill.total_amount) * 100;

  // Use actual bill transactions or empty array
  const transactions = bill.transactions || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Detalhes da Fatura - {account.name}
          </DialogTitle>
          <DialogDescription>
            Visualize e gerencie os detalhes da sua fatura de cartão de crédito
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bill Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Resumo da Fatura</span>
                {getStatusBadge(bill.status)}
              </CardTitle>
              <CardDescription>
                Período: {bill.billing_cycle} • Vencimento: {formatDate(bill.due_date)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(bill.total_amount)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Pagamento Mínimo</p>
                  <p className="text-xl font-semibold text-blue-600">
                    {formatCurrency(bill.minimum_payment)}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Valor Pago</p>
                  <p className="text-xl font-semibold text-green-600">
                    {formatCurrency(bill.paid_amount)}
                  </p>
                  {paymentProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>

              {isOverdue && bill.late_fee > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Fatura Vencida</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    Multa por atraso: {formatCurrency(bill.late_fee)}
                  </p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>Fechamento: {formatDate(bill.closing_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>Vencimento: {formatDate(bill.due_date)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          {remainingAmount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Informações de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2">Pagamento Mínimo</h4>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(bill.minimum_payment)}
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                      Evita juros e mantém o nome limpo
                    </p>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-800 mb-2">Valor Restante</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(remainingAmount)}
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Pagamento total recomendado
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Transações do Período</CardTitle>
              <CardDescription>
                Transações realizadas entre {formatDate(new Date(bill.closing_date.getTime() - 30 * 24 * 60 * 60 * 1000))} e {formatDate(bill.closing_date)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma transação encontrada neste período</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {formatDate(typeof transaction.date === 'string' ? createDateFromString(transaction.date) : transaction.date)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {transaction.description}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Transação</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(Math.abs(transaction.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Baixar Fatura
            </Button>
            
            {bill.status !== "paid" && onPayBill && (
              <Button 
                onClick={() => onPayBill(bill)} 
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Pagar Fatura
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}