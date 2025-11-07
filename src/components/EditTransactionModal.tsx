import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Transaction, Account } from "@/types"; // 'Account' não está sendo usado, pode remover se quiser
import { useCategories } from "@/hooks/useCategories";
import { createDateFromString } from "@/lib/dateUtils";
import { InstallmentEditScopeDialog, EditScope } from "./InstallmentEditScopeDialog";
import { useAccountStore } from "@/stores/AccountStore";

// MELHORIA DE EXCELÊNCIA (P1): Importar a máscara de moeda
import { PatternFormat } from "react-number-format";

interface EditTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTransaction: (transaction: Transaction, editScope?: EditScope) => void;
  transaction: Transaction | null;
}

// CORREÇÃO: 'amount' no formData agora armazena NÚMERO (centavos)
type FormData = {
  description: string;
  amount: number | undefined; // Armazena centavos (ex: 10050)
  date: Date;
  type: "income" | "expense";
  category_id: string;
  account_id: string;
  // CORREÇÃO: O schema do DB usa 'is_paid' (boolean)
  is_paid: boolean;
};

export function EditTransactionModal({
  open,
  onOpenChange,
  onEditTransaction,
  transaction
}: EditTransactionModalProps) {
  const [formData, setFormData] = useState<FormData>({
    description: "",
    amount: undefined, // Armazena centavos (ex: 10050)
    date: new Date(),
    type: "expense" as "income" | "expense",
    category_id: "",
    account_id: "",
    is_paid: true,
  });

  // REMOVIDO: O estado 'numericAmount' é redundante. 'formData.amount' guardará os centavos.
  // const [numericAmount, setNumericAmount] = useState<number | undefined>(undefined);

  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const { toast } = useToast();
  const { categories } = useCategories();
  const accounts = useAccountStore((state) => state.accounts);

  useEffect(() => {
    if (open && transaction) {
      const transactionDate = typeof transaction.date === 'string' ?
        createDateFromString(transaction.date.split('T')[0]) :
        transaction.date;
      
      const transactionType = transaction.type === "transfer" ? "expense" : transaction.type;
      
      // CORREÇÃO: O valor já é BIGINT (centavos, ex: 10050)
      const amountInCents = Math.abs(transaction.amount);

      setFormData({
        description: transaction.description,
        amount: amountInCents, // Armazena o NÚMERO de centavos
        date: transactionDate,
        type: transactionType as "income" | "expense",
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        // CORREÇÃO: 'status' é 'is_paid' no schema
        is_paid: transaction.is_paid
      });
      
    }
  }, [open, transaction]); // Removido transaction?.id da dependência, 'transaction' é suficiente

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
    // CORREÇÃO: Valida com o formData.amount (número de centavos)
    if (!formData.description.trim() || !formData.amount || !formData.account_id) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (formData.amount <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category_id) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma categoria.",
        variant: "destructive",
      });
      return;
    }

    const isInstallment = transaction.installments && transaction.installments > 1;
    
    if (isInstallment) {
      setScopeDialogOpen(true);
      return;
    }

    processEdit("current");
  };

  const processEdit = (editScope: EditScope) => {
    if (!transaction || !formData.amount) return;

    // CORREÇÃO: O valor em centavos (ex: 10050) já está em 'formData.amount'
    const amountInCents = formData.amount;

    const updatedTransaction: Transaction = {
      ...transaction,
      description: formData.description.trim(),
      amount: formData.type === 'income' ? amountInCents : -Math.abs(amountInCents),
      date: formData.date, // O 'onEditTransaction' deve formatar para 'YYYY-MM-DD' se necessário
      type: formData.type,
      category_id: formData.category_id,
      account_id: formData.account_id,
      // CORREÇÃO: 'status' é 'is_paid'
      is_paid: formData.is_paid,
      status: formData.is_paid ? 'completed' : 'pending', // Mantém compatibilidade com 'status' se a 'Transaction' type o tiver
    };

    onEditTransaction(updatedTransaction, editScope);
    
    const scopeDescription = editScope === "current" ? "A transação" : 
                           editScope === "all" ? "Todas as parcelas" :
                           "As parcelas restantes";
    
    toast({
      title: "Transação atualizada",
      description: `${scopeDescription} foi atualizada com sucesso.`,
    });

    onOpenChange(false);
  };

  const filteredCategories = categories.filter(cat => 
    cat.type === formData.type || cat.type === "both"
  );

  const isInstallment = transaction?.installments && transaction.installments > 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Editar Transação
              {isInstallment && (
                <span className="text-sm font-normal text-muted-foreground block">
                  Parcela {transaction.current_installment}/{transaction.installments}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Almoço no restaurante"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
            {/* CORREÇÃO: Ligar o PatternFormat ao estado 'formData.amount' (centavos) */}
            <PatternFormat
                id="amount"
                customInput={Input}
                placeholder="R$ 0,00"
                format="R$ #,##0.00"
                mask="_"
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                allowNegative={false}
                // O valor exibido é os centavos / 100
                value={typeof formData.amount === 'number' ? formData.amount / 100 : undefined}
                onValueChange={(values) => {
                  // Salva os centavos (int) de volta no estado
                  const centsValue = Math.round(Number(values.floatValue) * 100)
                  setFormData(prev => ({ ...prev, amount: centsValue }));
                }}
              />
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? (
                    format(formData.date, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione uma data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => date && setFormData({ ...formData, date })}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "income" | "expense") => 
                setFormData({ ...formData, type: value, category_id: "" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">Conta</Label>
            <Select
              value={formData.account_id}
              onValueChange={(value) => setFormData({ ...formData, account_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: account.color || "#6b7280" }}
                      />
                      {account.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CORREÇÃO: Alterado de 'Status' para 'Pago' (is_paid) */}
          <div className="space-y-2">
            <Label htmlFor="is_paid">Status</Label>
            <Select
              value={formData.is_paid ? "paid" : "pending"}
              onValueChange={(value: "paid" | "pending") => 
                setFormData({ ...formData, is_paid: value === "paid" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <InstallmentEditScopeDialog
      open={scopeDialogOpen}
      onOpenChange={setScopeDialogOpen}
      onScopeSelected={processEdit}
      currentInstallment={transaction?.current_installment || 1}
      totalInstallments={transaction?.installments || 1}
    />
  </>
  );
}