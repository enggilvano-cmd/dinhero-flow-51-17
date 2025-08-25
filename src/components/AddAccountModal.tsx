import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Account, PREDEFINED_COLORS, ACCOUNT_TYPE_LABELS } from "@/types";
import { ColorPicker } from "@/components/forms/ColorPicker";

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAccount: (account: Omit<Account, "id" | "user_id">) => void;
}

export function AddAccountModal({ open, onOpenChange, onAddAccount }: AddAccountModalProps) {
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

  const handleColorChange = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type || !formData.balance) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
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

    onAddAccount({
      name: formData.name,
      type: formData.type,
      balance: balance,
      limit_amount: limit,
      due_date: dueDate,
      closing_date: closingDate,
      color: formData.color
    });

    toast({
      title: "Sucesso",
      description: "Conta adicionada com sucesso!",
      variant: "default"
    });

    // Reset form
    setFormData({
      name: "",
      type: "",
      balance: "",
      limit: "",
      dueDate: "",
      closingDate: "",
      color: PREDEFINED_COLORS[0]
    });
    
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg sm:text-xl">Adicionar Nova Conta</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Nome da Conta */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Nome da Conta</Label>
            <Input
              id="name"
              placeholder="Ex: Banco do Brasil - Conta Corrente"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="h-10 sm:h-11"
            />
          </div>

          {/* Tipo de Conta */}
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium">Tipo de Conta</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}>
              <SelectTrigger className="h-10 sm:h-11">
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

          {/* Saldo/Valor */}
          <div className="space-y-2">
            <Label htmlFor="balance" className="text-sm font-medium">
              {formData.type === "credit" ? "Saldo Atual" : formData.type === "investment" ? "Valor Aplicado" : "Saldo Inicial"}
            </Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={formData.balance}
              onChange={(e) => setFormData(prev => ({ ...prev, balance: e.target.value }))}
              className="h-10 sm:h-11"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {formData.type === "credit" 
                ? "Para cartão de crédito, use valores negativos para dívidas"
                : formData.type === "investment"
                ? "Valor total aplicado no investimento"
                : "Saldo atual da conta"
              }
            </p>
          </div>

          {/* Limite da Conta */}
          <div className="space-y-2">
            <Label htmlFor="limit" className="text-sm font-medium">Limite da Conta (opcional)</Label>
            <Input
              id="limit"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={formData.limit}
              onChange={(e) => setFormData(prev => ({ ...prev, limit: e.target.value }))}
              className="h-10 sm:h-11"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Defina um limite opcional para esta conta. Útil para controlar teto de gastos.
            </p>
          </div>

          {/* Campos específicos para Cartão de Crédito */}
          {formData.type === "credit" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="closingDate" className="text-sm font-medium">Dia do Fechamento (opcional)</Label>
                <Input
                  id="closingDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 5"
                  value={formData.closingDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, closingDate: e.target.value }))}
                  className="h-10 sm:h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Dia do mês em que a fatura fecha
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-sm font-medium">Dia do Vencimento (opcional)</Label>
                <Input
                  id="dueDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 15"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="h-10 sm:h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Dia do mês em que a fatura vence
                </p>
              </div>
            </div>
          )}

          {/* Seleção de Cor */}
          <ColorPicker
            value={formData.color}
            onChange={handleColorChange}
            label="Cor da Conta"
          />

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              className="flex-1 h-10 sm:h-11"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 h-10 sm:h-11"
            >
              Adicionar Conta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}