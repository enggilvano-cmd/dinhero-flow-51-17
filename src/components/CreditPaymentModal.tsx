import { useState, useMemo } from "react";
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
}

export function CreditPaymentModal({ 
  open, 
  onOpenChange, 
  onPayment, 
  creditAccount 
}: CreditPaymentModalProps) {
  const [formData, setFormData] = useState({
    bankAccountId: "",
    amount: "",
    paymentType: "total" as "total" | "partial",
    date: getTodayString()
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const accounts = useAccountStore((state) => state.accounts);
  const updateAccountsInStore = useAccountStore((state) => state.updateAccounts);

  // Only bank accounts can pay credit cards
  const bankAccounts = useMemo(() => accounts.filter(acc => acc.type !== "credit"), [accounts]);

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

    // Check if bank account has sufficient balance or overdraft limit
    // Frontend validation for UX. The backend should always re-validate this rule
    // to ensure data integrity and prevent unauthorized transactions.
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

    // Check if payment amount is not greater than credit balance (debt)
    const creditDebtInCents = Math.abs(creditAccount.balance);
    if (amountInCents > creditDebtInCents && formData.paymentType !== 'total') {
      toast({
        title: "Valor Inválido",
        description: `O valor do pagamento não pode ser maior que a dívida de ${formatCurrency(creditDebtInCents)}.`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { creditAccount: updatedCreditAccount, bankAccount: updatedBankAccount } = await onPayment(
        // A lógica de pagamento de fatura deve ser tratada no backend como duas transações:
        // 1. Uma despesa na conta de origem (bankAccountId)
        // 2. Uma receita (amortização de dívida) na conta de destino (creditAccountId)
        // Esta chamada única assume que o backend abstrai essa complexidade.
        creditAccount.id,
        formData.bankAccountId,
        amountInCents,
        createDateFromString(formData.date)
      );

      // Atualiza as contas no store global
      updateAccountsInStore([updatedCreditAccount, updatedBankAccount]);

      // Reset form
      setFormData({
        bankAccountId: "",
        amount: "",
        paymentType: "total",
        date: getTodayString()
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Payment failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentTypeChange = (type: "total" | "partial") => {
    setFormData(prev => ({
      ...prev,
      paymentType: type,
      amount: type === "total" && creditAccount 
        ? (Math.abs(creditAccount.balance) / 100).toFixed(2).replace('.', ',')
        : ""
    }));
  };

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
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">{creditAccount.name}</h3>
              <p className="text-sm text-muted-foreground">
                Valor da fatura: <span className="font-medium balance-negative">
                  {formatCurrency(Math.abs(creditAccount.balance))}
                </span>
              </p>
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
                          {formatCurrency(account.balance)}
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
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={formData.paymentType === "total" ? "default" : "outline"}
                onClick={() => handlePaymentTypeChange("total")}
                className="h-auto p-3 flex-col"
              >
                <span className="font-medium">Pagamento Total</span>
                <span className="text-xs text-muted-foreground">
                  {creditAccount && formatCurrency(Math.abs(creditAccount.balance))}
                </span>
              </Button>
              <Button
                type="button"
                variant={formData.paymentType === "partial" ? "default" : "outline"}
                onClick={() => handlePaymentTypeChange("partial")}
                className="h-auto p-3 flex-col"
              >
                <span className="font-medium">Pagamento Parcial</span>
                <span className="text-xs text-muted-foreground">
                  Valor personalizado
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
                step="0.01"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                disabled={formData.paymentType === "total"}
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