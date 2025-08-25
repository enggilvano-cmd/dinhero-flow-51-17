import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDateFromString, getTodayString } from "@/lib/dateUtils";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  color: string;
  limit_amount?: number;
}

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: (fromAccountId: string, toAccountId: string, amount: number, date: Date) => void;
  accounts: Account[];
}

export function TransferModal({ open, onOpenChange, onTransfer, accounts }: TransferModalProps) {
  const [formData, setFormData] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    date: getTodayString()
  });
  const { toast } = useToast();

  // Filter out credit cards for transfers (only allow bank accounts)
  const transferableAccounts = accounts.filter(acc => acc.type !== "credit");

  const handleSubmit = (e: React.FormEvent) => {
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

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Erro", 
        description: "Por favor, insira um valor válido maior que zero.",
        variant: "destructive"
      });
      return;
    }

    // Check if source account has sufficient balance or overdraft limit
    const fromAccount = accounts.find(acc => acc.id === formData.fromAccountId);
    if (fromAccount) {
      const availableBalance = fromAccount.balance + (fromAccount.limit_amount || 0);
      if (availableBalance < amount) {
        const limitText = fromAccount.limit_amount 
          ? ` (incluindo limite de R$ ${fromAccount.limit_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
          : '';
        toast({
          title: "Saldo Insuficiente",
          description: `A conta ${fromAccount.name} não possui saldo suficiente para esta transferência${limitText}.`,
          variant: "destructive"
        });
        return;
      }
    }

    onTransfer(
      formData.fromAccountId,
      formData.toAccountId,
      amount,
      createDateFromString(formData.date)
    );

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
  };

  const getAvailableBalance = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return 0;
    return account.balance + (account.limit_amount || 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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
                  {transferableAccounts.map((account) => (
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
                <p className="text-sm text-muted-foreground">
                  Saldo disponível: {formatCurrency(getAvailableBalance(formData.fromAccountId))}
                  {(() => {
                    const account = accounts.find(acc => acc.id === formData.fromAccountId);
                    return account && account.limit_amount && account.limit_amount > 0 ? 
                      <span className="block text-xs text-blue-600">
                        (Saldo: {formatCurrency(account.balance)} + Limite: {formatCurrency(account.limit_amount)})
                      </span> : null;
                  })()}
                </p>
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
                  {transferableAccounts
                    .filter(account => account.id !== formData.fromAccountId)
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
                type="number"
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

          {transferableAccounts.length < 2 && (
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
              disabled={transferableAccounts.length < 2}
            >
              Realizar Transferência
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}