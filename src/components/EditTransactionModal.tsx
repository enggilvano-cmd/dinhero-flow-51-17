import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Transaction, Account, CreditBill } from "@/types";
import { useCategories } from "@/hooks/useCategories";
import { createDateFromString, formatDateForStorage } from "@/lib/dateUtils";
import { InstallmentEditScopeDialog, EditScope } from "./InstallmentEditScopeDialog";
import { supabase } from "@/integrations/supabase/client";

interface EditTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTransaction: (transaction: Transaction, editScope?: EditScope) => void;
  transaction: Transaction | null;
  accounts: Account[];
}

export function EditTransactionModal({
  open,
  onOpenChange,
  onEditTransaction,
  transaction,
  accounts
}: EditTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    date: new Date(),
    type: "expense" as "income" | "expense",
    category_id: "",
    account_id: "",
    status: "completed" as "pending" | "completed"
  });
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [availableBills, setAvailableBills] = useState<CreditBill[]>([]);
  const [selectedBill, setSelectedBill] = useState<string>("");
  const { toast } = useToast();
  const { categories } = useCategories();

  useEffect(() => {
    if (transaction) {
      // Use createDateFromString para evitar problemas de fuso horário
      const transactionDate = typeof transaction.date === 'string' ? 
        createDateFromString(transaction.date.split('T')[0]) : 
        transaction.date;
      // Only allow income/expense types in edit modal, transfers should be handled separately
      const transactionType = transaction.type === "transfer" ? "expense" : transaction.type;
      setFormData({
        description: transaction.description,
        amount: transaction.amount.toString(),
        date: transactionDate,
        type: transactionType as "income" | "expense",
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        status: transaction.status
      });
      
      // Load available bills if it's a credit card transaction
      const account = accounts.find(acc => acc.id === transaction.account_id);
      if (account?.type === "credit") {
        loadAvailableBills(account);
      }
    }
  }, [transaction, accounts]);

  const loadAvailableBills = async (creditAccount: Account) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('account_id', creditAccount.id)
        .order('date', { ascending: false });

      const bills = await generateCreditBillsForAccount(creditAccount, transactions || []);
      setAvailableBills(bills);
      
      // Find current bill for the transaction
      if (transaction) {
        const transactionDate = new Date(transaction.date);
        const currentBill = bills.find(bill => {
          const billStart = new Date(bill.closing_date);
          billStart.setMonth(billStart.getMonth() - 1);
          billStart.setDate(billStart.getDate() + 1);
          return transactionDate >= billStart && transactionDate <= bill.closing_date;
        });
        if (currentBill) {
          setSelectedBill(currentBill.id);
        }
      }
    } catch (error) {
      console.error('Error loading credit bills:', error);
    }
  };

  const generateCreditBillsForAccount = async (account: Account, accountTransactions: any[]): Promise<CreditBill[]> => {
    const bills: CreditBill[] = [];
    const today = new Date();
    const closingDay = account.closing_date || 21;
    const dueDay = account.due_date || 30;
    
    // Generate bills for the last 3 months and next 3 months
    for (let i = -3; i <= 3; i++) {
      const billMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const closingDate = new Date(billMonth.getFullYear(), billMonth.getMonth(), closingDay);
      const dueDate = new Date(billMonth.getFullYear(), billMonth.getMonth(), dueDay);
      
      if (dueDay < closingDay) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }
      
      const billingCycle = `${(closingDate.getMonth() + 1).toString().padStart(2, '0')}/${closingDate.getFullYear()}`;
      
      const bill: CreditBill = {
        id: `${account.id}-${billingCycle}`,
        account_id: account.id,
        billing_cycle: billingCycle,
        due_date: dueDate,
        closing_date: closingDate,
        total_amount: 0,
        paid_amount: 0,
        status: "pending",
        minimum_payment: 0,
        late_fee: 0,
        transactions: []
      };
      
      bills.push(bill);
    }
    
    return bills.sort((a, b) => a.closing_date.getTime() - b.closing_date.getTime());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
    if (!formData.description.trim() || !formData.amount || !formData.account_id) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido.",
        variant: "destructive",
      });
      return;
    }

    // Category is required for income/expense transactions
    if (!formData.category_id) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma categoria.",
        variant: "destructive",
      });
      return;
    }

    // Check if this is an installment transaction
    const isInstallment = transaction.installments && transaction.installments > 1;
    
    if (isInstallment) {
      // Open scope selection dialog for installment transactions
      setScopeDialogOpen(true);
      return;
    }

    // Process single transaction edit immediately
    processEdit("current");
  };

  const processEdit = (editScope: EditScope) => {
    if (!transaction) return;

    const amount = parseFloat(formData.amount);
    let finalDate = formData.date;
    
    // If credit card transaction and bill is selected, adjust date to be within bill period
    const account = accounts.find(acc => acc.id === formData.account_id);
    if (account?.type === "credit" && selectedBill) {
      const bill = availableBills.find(b => b.id === selectedBill);
      if (bill) {
        // Set date to the middle of the billing period
        const billStart = new Date(bill.closing_date);
        billStart.setMonth(billStart.getMonth() - 1);
        billStart.setDate(billStart.getDate() + 1);
        
        const billMiddle = new Date(billStart);
        const periodDays = Math.floor((bill.closing_date.getTime() - billStart.getTime()) / (1000 * 60 * 60 * 24));
        billMiddle.setDate(billMiddle.getDate() + Math.floor(periodDays / 2));
        
        finalDate = billMiddle;
      }
    }

    const updatedTransaction: Transaction = {
      ...transaction,
      description: formData.description.trim(),
      amount,
      date: finalDate,
      type: formData.type,
      category_id: formData.category_id,
      account_id: formData.account_id,
      status: formData.status
    };

    onEditTransaction(updatedTransaction, editScope);
    onOpenChange(false);
    
    const scopeDescription = editScope === "current" ? "A transação" : 
                           editScope === "all" ? "Todas as parcelas" :
                           editScope === "current-and-previous" ? "As parcelas selecionadas" :
                           "As parcelas restantes";
    
    toast({
      title: "Transação atualizada",
      description: `${scopeDescription} foi atualizada com sucesso.`,
    });
  };

  const filteredCategories = categories.filter(cat => 
    cat.type === formData.type || cat.type === "both"
  );

  const isInstallment = transaction?.installments && transaction.installments > 1;
  const selectedAccount = accounts.find(acc => acc.id === formData.account_id);
  const isCreditCard = selectedAccount?.type === "credit";

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
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0,00"
              required
            />
          </div>

          {!isCreditCard && (
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
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {isCreditCard && (
            <div className="space-y-2">
              <Label htmlFor="bill">Fatura do Cartão</Label>
              <Select
                value={selectedBill}
                onValueChange={(value) => setSelectedBill(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fatura">
                    {selectedBill && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        {availableBills.find(b => b.id === selectedBill)?.billing_cycle}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableBills.map((bill) => (
                    <SelectItem key={bill.id} value={bill.id}>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span>Fatura {bill.billing_cycle}</span>
                          <span className="text-xs text-muted-foreground">
                            Vence: {format(bill.due_date, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBill && (
                <p className="text-xs text-muted-foreground">
                  A data da transação será ajustada automaticamente para o período da fatura selecionada
                </p>
              )}
            </div>
          )}

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

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "pending" | "completed") => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
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