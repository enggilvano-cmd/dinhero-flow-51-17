import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Account, PREDEFINED_COLORS, ACCOUNT_TYPE_LABELS } from "@/types";
import { ColorPicker } from "@/components/forms/ColorPicker";

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditAccount: (account: Account) => void;
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
  const { toast } = useToast();

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        type: account.type,
        balance: account.balance.toString(),
        limit: account.limit_amount?.toString() || "",
        dueDate: account.due_date?.toString() || "",
        closingDate: account.closing_date?.toString() || "",
        color: account.color || PREDEFINED_COLORS[0]
      });
    }
  }, [account]);

  const handleSubmit = (e: React.FormEvent) => {
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

    const balance = parseFloat(formData.balance);
    if (isNaN(balance)) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido para o saldo.",
        variant: "destructive"
      });
      return;
    }

    let limit: number | undefined;
    if (formData.limit) {
      limit = parseFloat(formData.limit);
      if (isNaN(limit)) {
        toast({
          title: "Erro",
          description: "Por favor, insira um valor válido para o limite.",
          variant: "destructive"
        });
        return;
      }
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
      balance: balance,
      limit_amount: limit,
      due_date: dueDate,
      closing_date: closingDate,
      color: formData.color
    };

    onEditAccount(updatedAccount);

    toast({
      title: "Sucesso",
      description: "Conta atualizada com sucesso!",
      variant: "default"
    });
    
    onOpenChange(false);
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
              {formData.type === "credit" ? "Saldo Atual" : formData.type === "investment" ? "Valor Aplicado" : "Saldo"}
            </Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={formData.balance}
              onChange={(e) => setFormData(prev => ({ ...prev, balance: e.target.value }))}
              className="text-financial-input"
            />
            <p className="text-financial-caption">
              {formData.type === "credit" 
                ? "Para cartão de crédito, use valores negativos para dívidas"
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
              type="number"
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
            >
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}