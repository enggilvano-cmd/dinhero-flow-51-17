import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currencyStringToCents } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Account } from "@/types";
import { createDateFromString, getTodayString } from "@/lib/dateUtils";
import { formatCurrency, getAvailableBalance } from "@/lib/formatters";
import { AccountBalanceDetails } from "./AccountBalanceDetails";
import { useAccountStore } from "@/stores/AccountStore";

interface CreditPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPayment: (creditAccountId: string, bankAccountId: string, amountInCents: number, date: Date) => Promise<{ creditAccount: Account, bankAccount: Account }>;
  creditAccount: Account | null;  
  // Props para valores da fatura, passados pelo componente pai
  invoiceValueInCents?: number;
  nextInvoiceValueInCents?: number;
}

export function CreditPaymentModal({ 
  open, 
  onOpenChange, 
  onPayment, 
  creditAccount,
  invoiceValueInCents = 0,
  nextInvoiceValueInCents = 0
}: CreditPaymentModalProps) {
  const [formData, setFormData] = useState({
    bankAccountId: "",
    amount: "",
    paymentType: "invoice" as "invoice" | "total_balance" | "partial",
    date: getTodayString()
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const accounts = useAccountStore((state) => state.accounts);
  const updateAccountsInStore = useAccountStore((state) => state.updateAccounts);

  // Apenas contas bancárias podem pagar faturas
  const bankAccounts = useMemo(() => accounts.filter(acc => acc.type !== "credit"), [accounts]);

  useEffect(() => {
    if (open) {
      // Define o valor da fatura como padrão ao abrir
      handlePaymentTypeChange("invoice");
    } else {
      // Reseta o formulário ao fechar
      setFormData({
        bankAccountId: "",
        amount: "",
        paymentType: "invoice",
        date: getTodayString()
      });
    }
  }, [open, invoiceValueInCents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditAccount || !formData.bankAccountId || !formData.amount) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }

    // Validação e conversão para centavos
    const amountInCents = currencyStringToCents(formData.amount);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido maior que zero.",
        variant: "destructive"
      });
      return;
    }

    // Validação de saldo da conta de origem (UX)
    const bankAccount = accounts.find(acc => acc.id === formData.bankAccountId);
    if (bankAccount) {
      const availableBalanceInCents = getAvailableBalance(bankAccount);
      if (availableBalanceInCents < amountInCents) {
        const limitText = bankAccount.limit_amount 
          ? ` (incluindo limite de ${formatCurrency(bankAccount.limit_amount)})`
          : '';
        toast({
          title: "Saldo Insuficiente",
          description: `A conta ${bankAccount.name} não possui saldo suficiente para este pagamento${limitText}.`,
          variant: "destructive"
        });
        return;
      }
    }

    // O usuário não pode pagar mais do que o saldo devedor total.
    const totalDebtInCents = Math.abs(creditAccount.balance);
    if (amountInCents > totalDebtInCents) {
      toast({
        title: "Valor Inválido",
        description: `O valor do pagamento ( ${formatCurrency(amountInCents)} ) não pode ser maior que a dívida total de ${formatCurrency(totalDebtInCents)}.`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { creditAccount: updatedCreditAccount, bankAccount: updatedBankAccount } = await onPayment(
        creditAccount.id,
        formData.bankAccountId,
        amountInCents,
        createDateFromString(formData.date)
      );

      // Atualiza as contas no store global
      updateAccountsInStore([updatedCreditAccount, updatedBankAccount]);
      onOpenChange(false); // Fechar o modal
    } catch (error) {
      console.error("Payment failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentTypeChange = (type: "invoice" | "total_balance" | "partial") => {
    let newAmount = "";
    if (type === "invoice" && creditAccount) {
      // Pagar a fatura fechada
      newAmount = (invoiceValueInCents / 100).toFixed(2).replace('.', ',');
    } else if (type === "total_balance" && creditAccount) {
      // Pagar o saldo devedor total (fatura fechada + fatura aberta)
      newAmount = (Math.abs(creditAccount.balance) / 100).toFixed(2).replace('.', ',');
    }
    // Se for 'partial', newAmount fica "" e o input é liberado

    setFormData(prev => ({
      ...prev,
      paymentType: type,
      amount: newAmount
    }));
  };
  
  // O saldo devedor total (ex: -50000)
  const totalDebtInCents = creditAccount ? Math.abs(creditAccount.balance) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Pagamento de Fatura</DialogTitle>
          <DialogDescription>
            Realize o pagamento da fatura do seu cartão de crédito
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {creditAccount && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h3 className="font-semibold">{creditAccount.name}</h3>
              <div className="text-sm space-y-1">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Fatura Fechada:</span>
                  <span className="font-medium balance-negative">
                    {formatCurrency(invoiceValueInCents || 0)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Fatura Aberta:</span>
                  <span className="font-medium text-muted-foreground">
                    {formatCurrency(nextInvoiceValueInCents)}
                  </span>
                </p>
                <p className="flex justify-between text-base font-semibold border-t pt-1 mt-1">
                  <span className="text-foreground">Saldo Devedor Total:</span>
                  <span className="balance-negative">
                    {formatCurrency(totalDebtInCents)}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bankAccount">Conta para Pagamento</Label>
            <Select value={formData.bankAccountId} onValueChange={(value) => setFormData(prev => ({ ...prev, bankAccountId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta bancária" />
              </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: account.color || "#6b7280" }}
                          />
                          <span>{account.name}</span>
                        </div>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {formatCurrency(getAvailableBalance(account))}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>
            {formData.bankAccountId && (
              <AccountBalanceDetails account={accounts.find(acc => acc.id === formData.bankAccountId)} />
            )}
          </div>

          <div className="space-y-3">
            <Label>Tipo de Pagamento</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={formData.paymentType === "invoice" ? "default" : "outline"}
                onClick={() => handlePaymentTypeChange("invoice")}
                className="h-auto p-2 flex-col"
                disabled={invoiceValueInCents <= 0}
              >
                <span className="font-medium text-xs">Pagar Fatura</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(invoiceValueInCents)}
                </span>
              </Button>
              <Button
                type="button"
                variant={formData.paymentType === "total_balance" ? "default" : "outline"}
                onClick={() => handlePaymentTypeChange("total_balance")}
                className="h-auto p-2 flex-col"
                disabled={totalDebtInCents <= 0}
              >
                <span className="font-medium text-xs">Pagar Total</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(totalDebtInCents)}
                </span>
              </Button>
              <Button
                type="button"
                variant={formData.paymentType === "partial" ? "default" : "outline"}
                onClick={() => handlePaymentTypeChange("partial")}
                className="h-auto p-2 flex-col"
              >
                <span className="font-medium text-xs">Outro Valor</span>
                <span className="text-xs text-muted-foreground">
                  Valor manual
                </span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor do Pagamento (R$)</Label>
              <Input
                id="amount"
                type="text"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  amount: e.target.value,
                  // Se o usuário digitar, muda para pagamento parcial
                  paymentType: "partial"
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data do Pagamento</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>

          {bankAccounts.length === 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Atenção:</strong> Você precisa ter pelo menos uma conta bancária cadastrada para pagar faturas de cartão.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={bankAccounts.length === 0 || isSubmitting}
            >
              {isSubmitting ? "Realizando..." : "Realizar Pagamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}