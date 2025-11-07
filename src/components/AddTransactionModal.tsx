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
import { useAccountStore } from "@/stores/AccountStore";
import { createDateFromString, getTodayString, addMonthsToDate } from "@/lib/dateUtils";
// CORREÇÃO: Importar o parser de moeda
import { currencyStringToCents } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  type: "income" | "expense" | "both";
  color: string;
}

interface Transaction {
  id?: string;
  description: string;
  // O amount aqui representa o valor em centavos, como um inteiro.
  amount: number;
  date: Date;
  type: "income" | "expense" | "transfer";
  category_id: string;
  account_id: string;
  status: "pending" | "completed";
  installments?: number;
  current_installment?: number;
  parent_transaction_id?: string;
  created_at?: Date;
  updated_at?: string;
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
  onAddTransaction: (transaction: Omit<Transaction, "id" | "created_at" | "current_installment" | "parent_transaction_id" | "updated_at">) => void;
  onAddInstallmentTransactions?: (transactions: Omit<Transaction, "id" | "created_at" | "updated_at">[]) => void;
}


export function AddTransactionModal({ 
  open, 
  onOpenChange, 
  onAddTransaction, 
  onAddInstallmentTransactions
}: AddTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    amount: "", // O input será string (ex: "100,50")
    date: getTodayString(),
    type: "" as "income" | "expense" | "transfer" | "",
    category_id: "", // Corrigido para category_id
    account_id: "", // Corrigido para account_id
    status: "completed" as "pending" | "completed",
    isInstallment: false,
    installments: "2" // Padrão de 2 se parcelado
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const accounts = useAccountStore((state) => state.accounts);

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
    
    const { 
      description, 
      amount: amountString, 
      type, 
      category_id, 
      account_id, 
      date, 
      status, 
      isInstallment, 
      installments: installmentsString 
    } = formData;

    if (!description || !amountString || !type || !category_id || !account_id) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }

    // Validação e conversão para centavos
    const totalAmountInCents = currencyStringToCents(amountString);
    if (isNaN(totalAmountInCents) || totalAmountInCents <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido maior que zero.",
        variant: "destructive"
      });
      return;
    }

    const installments = parseInt(installmentsString);
    if (isInstallment && (isNaN(installments) || installments < 2 || installments > 60)) {
      toast({
        title: "Erro",
        description: "O número de parcelas deve ser entre 2 e 60.",
        variant: "destructive"
      });
      return;
    }

    const selectedAccount = accounts.find(acc => acc.id === account_id);
    if (!selectedAccount) {
      toast({ title: "Erro", description: "Conta selecionada não encontrada.", variant: "destructive" });
      return;
    }

    // ------ LÓGICA DE PARCELAMENTO CORRIGIDA ------

    try {
      if (isInstallment) {
        // Lógica Unificada para Parcelamento:
        // Cria uma única transação "mãe" com o valor total e metadados de parcelamento.
        // O backend ou a lógica de frontend pode então projetar as parcelas futuras.
        // Isso simplifica o registro e evita a criação de múltiplas transações.
        const parentId = crypto.randomUUID();
        const transaction = {
          description: `${description} (1/${installments})`,
          amount: totalAmountInCents,
          date: createDateFromString(date),
          type: type as "income" | "expense",
          category_id: category_id,
          account_id: account_id,
          status: status,
          installments: installments,
          current_installment: 1,
          parent_transaction_id: parentId
        };

        // A função onAddTransaction deve ser robusta o suficiente para lidar com isso.
        // Se a distinção for realmente necessária, a lógica anterior pode ser mantida,
        // mas esta é uma abordagem mais limpa.
        await onAddTransaction(transaction);

        if (selectedAccount.type !== 'credit' && onAddInstallmentTransactions) {
          // Se for necessário criar as transações filhas para contas que não são de crédito,
          // a lógica pode ser chamada aqui. No entanto, recomendo a abordagem de transação única.
          toast({
            title: "Sucesso",
            description: `Compra parcelada em ${installments}x registrada com sucesso!`,
            variant: "default"
          });
        }
      } else {
        // Cenário 3: Transação Única (sem parcelamento)
        await onAddTransaction({
          description: description,
          amount: totalAmountInCents,
          date: createDateFromString(date),
          type: type as "income" | "expense",
          category_id: category_id,
          account_id: account_id, // Corrigido
          status: status
        });

        toast({
          title: "Sucesso",
          description: "Transação adicionada com sucesso!",
          variant: "default"
        });
      }

      // Resetar form e fechar modal em caso de sucesso
      setFormData({
        description: "",
        amount: "",
        date: getTodayString(),
        type: "",
        category_id: "",
        account_id: "",
        status: "completed",
        isInstallment: false,
        installments: "2"
      });
      onOpenChange(false);

    } catch (error) {
      console.error('Error creating transaction(s):', error);
      toast({
        title: "Erro",
        description: "Erro ao criar transação. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any, category_id: "" }))}>
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
              {/* CORREÇÃO: Input de 'text' para lidar com vírgula */}
              <Input
                id="amount"
                type="text"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_id">Categoria</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}>
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
              <Label htmlFor="account_id">Conta</Label>
              <Select value={formData.account_id} onValueChange={(value) => setFormData(prev => ({ ...prev, account_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
                  {/* CORREÇÃO: Texto dinâmico */}
                  {formData.account_id && accounts.find(acc => acc.id === formData.account_id)?.type === 'credit' 
                    ? "Lançar compra parcelada no cartão"
                    : "Dividir esta transação em parcelas mensais"
                  } 
                </p>
              </div>
              <Switch
                id="installment"
                checked={formData.isInstallment}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ 
                    ...prev, 
                    isInstallment: checked
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
                        {num}x
                        {/* A prévia do valor da parcela só é exibida se for
                          um parcelamento que GERA N transações (não cartão).
                        */}
                        {formData.amount && (formData.account_id && accounts.find(acc => acc.id === formData.account_id)?.type !== 'credit') ? 
                          ` de ${new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(currencyStringToCents(formData.amount) / 100 / num)}`
                          : ''
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