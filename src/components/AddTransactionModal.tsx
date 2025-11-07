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
// CORREÇÃO: Importar o parser de moeda (agora apenas para o preview da parcela)
import { currencyStringToCents } from "@/lib/utils";

// MELHORIA DE EXCELÊNCIA (P1): Importar a máscara de moeda
import { PatternFormat } from "react-number-format";

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
  category_id: string;
  account_id: string;
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
  onAddTransaction: (transaction: Omit<Transaction, "id" | "createdAt" | "currentInstallment" | "parentTransactionId" | "installments">) => void;
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
    amount: "", // O input será string (ex: "100,50")
    date: getTodayString(),
    type: "" as "income" | "expense" | "transfer" | "",
    category_id: "",
    account_id: "",
    status: "completed" as "pending" | "completed",
    isInstallment: false,
    installments: "2"
  });
  // MELHORIA DE EXCELÊNCIA (P1): Estado separado para o valor numérico
  const [numericAmount, setNumericAmount] = useState<number | undefined>(undefined);

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
    if (open && user) {
        loadCategories();
    }
  }, [user, open]);

  // Atualiza o status baseado na data
  useEffect(() => {
    if (formData.date) {
      const transactionDateStr = formData.date;
      const todayStr = getTodayString();
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
      type,
      category_id,
      account_id,
      date,
      status,
      isInstallment,
      installments: installmentsString
    } = formData;

    // MELHORIA DE EXCELÊNCIA (P1): Usa o estado numérico
    if (!description || !numericAmount || !type || !category_id || !account_id) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }

    // O valor já é um decimal (ex: 100.50) vindo do react-number-format
    const totalAmountAsDecimal = numericAmount;
    if (totalAmountAsDecimal <= 0) {
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
    
    // ... (resto da lógica de validação) ...

    try {
      if (isInstallment && onAddInstallmentTransactions) {
        
        // Convertemos o decimal para centavos para a lógica de divisão
        const totalAmountInCents = Math.round(totalAmountAsDecimal * 100);
        const baseInstallmentCents = Math.floor(totalAmountInCents / installments);
        const remainderCents = totalAmountInCents % installments;

        const transactions = [];
        const baseDate = createDateFromString(date);
        const parentId = crypto.randomUUID();
        const todayStr = getTodayString();

        for (let i = 0; i < installments; i++) {
          const installmentAmountInCents = i === 0 ? (baseInstallmentCents + remainderCents) : baseInstallmentCents;
          const installmentAmountAsDecimal = installmentAmountInCents / 100.0; // Converte de volta
          
          const installmentDate = addMonthsToDate(baseDate, i);
          const installmentDateStr = installmentDate.toISOString().split('T')[0];
          
          // MELHORIA DE EXCELÊNCIA (C1): Status da parcela baseado na data
          const installmentStatus = installmentDateStr <= todayStr ? "completed" : "pending";

          const transaction = {
            description: `${description} (${i + 1}/${installments})`,
            amount: type === 'expense' ? -Math.abs(installmentAmountAsDecimal) : installmentAmountAsDecimal,
            date: installmentDate,
            type: type as "income" | "expense",
            category_id: category_id,
            account_id: account_id,
            status: installmentStatus, // Usa o status da parcela
            installments: installments,
            currentInstallment: i + 1,
            parentTransactionId: parentId
          };
          transactions.push(transaction);
        }

        await onAddInstallmentTransactions(transactions);
        toast({
          title: "Sucesso",
          description: `Transação dividida em ${installments}x adicionada com sucesso!`,
          variant: "default"
        });

      } else {
        // Transação Única
        await onAddTransaction({
          description: description,
          amount: type === 'expense' ? -Math.abs(totalAmountAsDecimal) : totalAmountAsDecimal,
          date: createDateFromString(date),
          type: type as "income" | "expense",
          category_id: category_id,
          account_id: account_id,
          status: status // Usa o status do formulário
        });

        toast({
          title: "Sucesso",
          description: "Transação adicionada com sucesso!",
          variant: "default"
        });
      }

      // Resetar form e fechar modal
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
      setNumericAmount(undefined); // Limpa o estado numérico
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error creating transaction(s):', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar transação. Tente novamente.",
        variant: "destructive"
      });
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
              {/* MELHORIA DE EXCELÊNCIA (P1): Substituir Input por PatternFormat */}
              <PatternFormat
                id="amount"
                customInput={Input}
                placeholder="R$ 0,00"
                format="R$ #.##0,00"
                mask="_"
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                allowNegative={false}
                value={formData.amount}
                onValueChange={(values) => {
                  setFormData(prev => ({ ...prev, amount: values.formattedValue }));
                  setNumericAmount(values.floatValue); // Salva o valor numérico
                }}
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
                  Dividir esta transação em parcelas mensais.
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
                        {/* A prévia do valor da parcela */}
                        {numericAmount ?
                          ` de ${new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(numericAmount / num)}`
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