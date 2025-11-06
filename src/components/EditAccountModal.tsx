import { useState, useEffect, FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currencyStringToCents } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Account, PREDEFINED_COLORS, ACCOUNT_TYPE_LABELS } from "@/types";
import { ColorPicker } from "@/components/forms/ColorPicker";
import { useAccountStore } from "@/stores/AccountStore";

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditAccount: (account: Account) => Promise<void>;
  account: Account | null;
}

export function EditAccountModal({ open, onOpenChange, onEditAccount, account }: EditAccountModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "" as "checking" | "savings" | "credit" | "investment" | "",
    balance: "",
    limit: "",
    dueDate: "",
    closingDate: "",
    color: PREDEFINED_COLORS[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const updateAccountInStore = useAccountStore((state) => state.updateAccount);

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        type: account.type,
        // Para cartões, mostra o valor da dívida como positivo na UI para consistência
        balance: (Math.abs(account.balance) / 100).toFixed(2).replace('.', ','),
        limit: account.limit_amount ? (account.limit_amount / 100).toFixed(2).replace('.', ',') : "",
        dueDate: account.due_date?.toString() || "",
        closingDate: account.closing_date?.toString() || "",
        color: account.color || PREDEFINED_COLORS[0]
      });
    }
  }, [account]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!account) return;
    
    if (!formData.name.trim() || !formData.type || !formData.balance) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    // Se for cartão de crédito, sempre armazene o saldo como negativo (dívida).
    const rawBalanceInCents = currencyStringToCents(formData.balance);
    const balanceInCents = formData.type === 'credit' 
      ? -Math.abs(rawBalanceInCents) 
      : rawBalanceInCents;

    if (isNaN(rawBalanceInCents)) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido para o saldo.",
        variant: "destructive"
      });
      return;
    }

    let limitInCents: number | undefined;
    if (formData.limit) {
      const parsedLimit = currencyStringToCents(formData.limit);
      if (isNaN(parsedLimit)) {
        toast({
          title: "Erro",
          description: "Por favor, insira um valor válido para o limite.",
          variant: "destructive"
        });
        return;
      }
      limitInCents = parsedLimit;
    }

    let dueDate: number | undefined;
    if (formData.type === "credit" && formData.dueDate) {
      dueDate = parseInt(formData.dueDate);
      if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) {
        toast({
          title: "Erro",
          description: "Por favor, insira um dia válido (1-31) para o vencimento.",
          variant: "destructive"
        });
        return;
      }
    }

    let closingDate: number | undefined;
    if (formData.type === "credit" && formData.closingDate) {
      closingDate = parseInt(formData.closingDate);
      if (isNaN(closingDate) || closingDate < 1 || closingDate > 31) {
        toast({
          title: "Erro",
          description: "Por favor, insira um dia válido (1-31) para o fechamento.",
          variant: "destructive"
        });
        return;
      }
    }

    const updatedAccount = {
      id: account.id,
      user_id: account.user_id,
      name: formData.name.trim(),
      type: formData.type,
      balance: balanceInCents,
      limit_amount: limitInCents,
      due_date: dueDate,
      closing_date: closingDate,
      color: formData.color
    };

    setIsSubmitting(true);
    try {
      await onEditAccount(updatedAccount);

      // Atualiza a conta no store global
      updateAccountInStore(updatedAccount);

      toast({
        title: "Sucesso",
        description: "Conta atualizada com sucesso!",
        variant: "default"
      });
    } catch (error) {
      console.error("Failed to edit account:", error);
      // O toast de erro deve ser tratado dentro do onEditAccount ou aqui
    } finally {
      setIsSubmitting(false);
      onOpenChange(false);
    }
  };

  const handleColorChange = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="text-financial-h3">Editar Conta</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-financial-secondary font-medium">Nome da Conta</Label>
            <Input
              id="name"
              placeholder="Ex: Banco do Brasil - Conta Corrente"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="text-financial-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type" className="text-financial-secondary font-medium">Tipo de Conta</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}>
              <SelectTrigger className="text-financial-input">
                <SelectValue placeholder="Selecione o tipo de conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">{ACCOUNT_TYPE_LABELS.checking}</SelectItem>
                <SelectItem value="savings">{ACCOUNT_TYPE_LABELS.savings}</SelectItem>
                <SelectItem value="credit">{ACCOUNT_TYPE_LABELS.credit}</SelectItem>
                <SelectItem value="investment">{ACCOUNT_TYPE_LABELS.investment}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance" className="text-financial-secondary font-medium">
              {formData.type === "credit" ? "Saldo Devedor Atual" : formData.type === "investment" ? "Valor Aplicado" : "Saldo"}
            </Label>
            <Input
              id="balance"
              type="text"
              step="0.01"
              placeholder="0,00"
              value={formData.balance}
              onChange={(e) => setFormData(prev => ({ ...prev, balance: e.target.value }))}
              className="text-financial-input"
            />
            <p className="text-financial-caption">
              {formData.type === "credit" 
                ? "Insira o valor total que você deve no cartão neste momento (faturas abertas + fechadas não pagas)."
                : formData.type === "investment"
                ? "Valor total aplicado no investimento"
                : "Saldo atual da conta"
              }
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="limit" className="text-financial-secondary font-medium">Limite da Conta (opcional)</Label>
            <Input
              id="limit"
              type="text"
              step="0.01"
              placeholder="0,00"
              value={formData.limit}
              onChange={(e) => setFormData(prev => ({ ...prev, limit: e.target.value }))}
              className="text-financial-input"
            />
            <p className="text-financial-caption">
              Defina um limite opcional para esta conta. Útil para controlar teto de gastos.
            </p>
          </div>

          {formData.type === "credit" && (
            <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 bg-muted/50 rounded-lg border-l-4 border-primary/30">
              <h4 className="text-financial-body font-medium text-primary">Configurações do Cartão de Crédito</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="closingDate" className="text-financial-secondary font-medium">Fechamento</Label>
                  <Input
                    id="closingDate"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 5"
                    value={formData.closingDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, closingDate: e.target.value }))}
                    className="text-financial-input"
                  />
                  <p className="text-financial-caption">
                    Dia do fechamento
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-financial-secondary font-medium">Vencimento</Label>
                  <Input
                    id="dueDate"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 15"
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="text-financial-input"
                  />
                  <p className="text-financial-caption">
                    Dia do vencimento
                  </p>
                </div>
              </div>
            </div>
          )}

          <ColorPicker
            value={formData.color}
            onChange={handleColorChange}
          />

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              className="flex-1 text-financial-button touch-target"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 text-financial-button bg-primary hover:bg-primary/90 text-primary-foreground touch-target"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}