import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currencyStringToCents } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDateFromString, getTodayString } from "@/lib/dateUtils";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast"; // Textarea não está sendo usado, pode ser removido se não for planejado.
import { formatCurrency, getAvailableBalance } from "@/lib/formatters";
import { ArrowRight } from "lucide-react";
import { AccountBalanceDetails } from "./AccountBalanceDetails";
import { useAccountStore } from "@/stores/AccountStore";
import { Account } from "@/types";

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: (fromAccountId: string, toAccountId: string, amountInCents: number, date: Date) => Promise<{ fromAccount: Account, toAccount: Account }>;
}

export function TransferModal({ open, onOpenChange, onTransfer }: TransferModalProps) {
  const [formData, setFormData] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    date: getTodayString()
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const accounts = useAccountStore((state) => state.accounts);
  const updateAccountsInStore = useAccountStore((state) => state.updateAccounts);

  // Contas de origem podem ser qualquer tipo, exceto crédito.
  const sourceAccounts = useMemo(() => accounts.filter(acc => acc.type !== "credit"), [accounts]);
  
  // Contas de destino também não podem ser de crédito para evitar ambiguidade com pagamento de fatura.
  const destinationAccounts = useMemo(() => 
    accounts.filter(acc => acc.type !== "credit" && acc.id !== formData.fromAccountId), 
    [accounts, formData.fromAccountId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fromAccountId || !formData.toAccountId || !formData.amount) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }

    if (formData.fromAccountId === formData.toAccountId) {
      toast({
        title: "Erro",
        description: "As contas de origem e destino devem ser diferentes.",
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

    // Check if source account has sufficient balance or overdraft limit
    // Frontend validation for UX. The backend should always re-validate this rule
    // to ensure data integrity and prevent unauthorized transactions.
    const fromAccount = sourceAccounts.find(acc => acc.id === formData.fromAccountId);
    if (fromAccount) {
      const availableBalanceInCents = getAvailableBalance(fromAccount);
      if (availableBalanceInCents < amountInCents) {
        const limitText = fromAccount.limit_amount 
          ? ` (incluindo limite de ${formatCurrency(fromAccount.limit_amount)})`
          : '';
        toast({
          title: "Saldo Insuficiente",
          description: `A conta ${fromAccount.name} não possui saldo suficiente para esta transferência${limitText}.`,
          variant: "destructive"
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { fromAccount: updatedFromAccount, toAccount: updatedToAccount } = await onTransfer(
        // Uma transferência deve ser tratada no backend como duas transações atômicas:
        // 1. Uma despesa na conta de origem (fromAccountId)
        // 2. Uma receita na conta de destino (toAccountId)
        // Esta chamada única assume que o backend abstrai essa complexidade.
        formData.fromAccountId,
        formData.toAccountId,
        amountInCents,
        createDateFromString(formData.date)
      );

      // Atualiza as contas no store global
      updateAccountsInStore([updatedFromAccount, updatedToAccount]);

      toast({
        title: "Sucesso",
        description: "Transferência realizada com sucesso!",
        variant: "default"
      });

      // Reset form
      setFormData({
        fromAccountId: "",
        toAccountId: "",
        amount: "",
        date: getTodayString()
      });

      onOpenChange(false);
    } catch (error) {
      // A função onTransfer deve lançar um erro em caso de falha para este bloco ser ativado.
      console.error("Transfer failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Transferência</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromAccount">Conta de Origem</Label>
              <Select value={formData.fromAccountId} onValueChange={(value) => setFormData(prev => ({ ...prev, fromAccountId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta de origem" />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((account) => (
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
              {formData.fromAccountId && (
                <AccountBalanceDetails account={accounts.find(acc => acc.id === formData.fromAccountId)} />
              )}
            </div>

            <div className="flex justify-center">
              <div className="p-2 bg-muted rounded-full">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="toAccount">Conta de Destino</Label>
              <Select value={formData.toAccountId} onValueChange={(value) => setFormData(prev => ({ ...prev, toAccountId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {destinationAccounts
                    .map((account) => (
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor da Transferência (R$)</Label>
              <Input
                id="amount"
                type="text"
                step="0.01"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-2">
            Cartões de crédito não são listados para transferências.
            <br />
            Para pagar uma fatura, use a opção 'Pagar Fatura' na tela de contas.
          </p>

          {sourceAccounts.length < 2 && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Atenção:</strong> Você precisa ter pelo menos 2 contas bancárias (corrente ou poupança) cadastradas para realizar transferências.
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
              disabled={sourceAccounts.length < 2 || isSubmitting}
            >
              {isSubmitting ? "Realizando..." : "Realizar Transferência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}