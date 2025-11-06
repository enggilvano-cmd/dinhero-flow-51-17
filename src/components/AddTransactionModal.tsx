import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createDateFromString, getTodayString, addMonthsToDate } from "@/lib/dateUtils";

interface Category {
  id: string;
  name: string;
  type: "income" | "expense" | "both";
  color: string;
}

interface Transaction {
  id?: string;
  description: string;
  amount: number;
  date: Date;
  type: "income" | "expense" | "transfer";
  category: string;
  accountId: string;
  status: "pending" | "completed";
  installments?: number;
  currentInstallment?: number;
  parentTransactionId?: string;
  createdAt?: Date;
}

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  color: string;
}

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTransaction: (transaction: Omit<Transaction, "id" | "createdAt">) => void;
  onAddInstallmentTransactions?: (transactions: Omit<Transaction, "id" | "createdAt">[]) => void;
  accounts: Account[];
}


export function AddTransactionModal({ 
  open, 
  onOpenChange, 
  onAddTransaction, 
  onAddInstallmentTransactions,
  accounts 
}: AddTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    date: getTodayString(),
    type: "" as "income" | "expense" | "transfer" | "",
    category: "",
    accountId: "",
    status: "completed" as "pending" | "completed",
    isInstallment: false,
    installments: "1"
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const loadCategories = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error loading categories:', error);
        return;
      }
      
      setCategories(data || []);
    };
    
    loadCategories();
  }, [user]);

  // Automatically set status based on transaction date
  useEffect(() => {
    if (formData.date) {
      // Create dates from date strings to avoid timezone issues
      const transactionDateStr = formData.date; // YYYY-MM-DD format
      const todayStr = getTodayString(); // YYYY-MM-DD format
      
      const newStatus = transactionDateStr <= todayStr ? "completed" : "pending";
      
      if (formData.status !== newStatus) {
        setFormData(prev => ({ ...prev, status: newStatus }));
      }
    }
  }, [formData.date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description || !formData.amount || !formData.type || !formData.category || !formData.accountId) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
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

    const installments = parseInt(formData.installments);
    if (formData.isInstallment && (isNaN(installments) || installments < 2 || installments > 60)) {
      toast({
        title: "Erro",
        description: "O número de parcelas deve ser entre 2 e 60.",
        variant: "destructive"
      });
      return;
    }

    if (formData.isInstallment && onAddInstallmentTransactions) {
      console.log('Creating installment transactions with', installments, 'installments');
      
      // Create installment transactions
      const installmentAmount = amount / installments;
      const baseDate = createDateFromString(formData.date);
      const transactions = [];
      const parentId = crypto.randomUUID(); // Gera um ID único para o grupo de parcelas

      for (let i = 0; i < installments; i++) {
        const installmentDate = addMonthsToDate(baseDate, i);
        
        // Determine status based on installment date
        const installmentDateStr = installmentDate.toISOString().split('T')[0];
        const todayStr = getTodayString();
        const installmentStatus = installmentDateStr <= todayStr ? "completed" : "pending";

        const transaction = {
          description: `${formData.description} (${i + 1}/${installments})`,
          amount: installmentAmount,
          date: installmentDate,
          type: formData.type as "income" | "expense",
          category: formData.category,
          accountId: formData.accountId,
          status: installmentStatus as "completed" | "pending",
          installments: installments,
          currentInstallment: i + 1,
          parentTransactionId: parentId // Vincula todas as parcelas com o mesmo ID pai
        };
        
        transactions.push(transaction);
      }

      console.log('Transactions to be created:', transactions);
      try {
        await onAddInstallmentTransactions(transactions);
        
        toast({
          title: "Sucesso",
          description: `Transação parcelada em ${installments}x adicionada com sucesso!`,
          variant: "default"
        });
        
        // Reset form only after successful creation
        setFormData({
          description: "",
          amount: "",
          date: getTodayString(),
          type: "",
          category: "",
          accountId: "",
          status: "completed",
          isInstallment: false,
          installments: "1"
        });
        
        onOpenChange(false);
      } catch (error) {
        console.error('Error creating installment transactions:', error);
        toast({
          title: "Erro",
          description: "Erro ao criar transações parceladas. Tente novamente.",
          variant: "destructive"
        });
      }
    } else {
      // Regular transaction
      onAddTransaction({
        description: formData.description,
        amount: amount,
        date: createDateFromString(formData.date),
        type: formData.type,
        category: formData.category,
        accountId: formData.accountId,
        status: formData.status
      });

      toast({
        title: "Sucesso",
        description: "Transação adicionada com sucesso!",
        variant: "default"
      });
      
      // Reset form
      setFormData({
        description: "",
        amount: "",
        date: getTodayString(),
        type: "",
        category: "",
        accountId: "",
        status: "completed",
        isInstallment: false,
        installments: "1"
      });
      
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Nova Transação</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Compra no supermercado"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter(cat => 
                      formData.type === "" || 
                      cat.type === formData.type || 
                      cat.type === "both"
                    )
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account">Conta</Label>
              <Select value={formData.accountId} onValueChange={(value) => setFormData(prev => ({ ...prev, accountId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
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
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as "pending" | "completed" }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Efetuada</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>


          {/* Installment Options */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="installment">Transação Parcelada</Label>
                <p className="text-sm text-muted-foreground">
                  Dividir esta transação em parcelas mensais
                </p>
              </div>
              <Switch
                id="installment"
                checked={formData.isInstallment}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ 
                    ...prev, 
                    isInstallment: checked,
                    installments: checked ? "2" : "1"
                  }))
                }
              />
            </div>

            {formData.isInstallment && (
              <div className="space-y-2">
                <Label htmlFor="installments">Número de Parcelas</Label>
                <Select 
                  value={formData.installments} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, installments: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 59 }, (_, i) => i + 2).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}x de {formData.amount ? 
                          new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(parseFloat(formData.amount) / num) 
                          : 'R$ 0,00'
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Adicionar Transação
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}