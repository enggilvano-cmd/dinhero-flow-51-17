import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from './ui/button'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Input } from './ui/input'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { cn } from '@/lib/utils'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from './ui/calendar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAccountStore } from '@/stores/AccountStore'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
// CORREÇÃO: Importa de '@/components/CurrencyInput'
import { CurrencyInput } from './CurrencyInput'
import { useToast } from '@/hooks/use-toast' // CORREÇÃO: Importar useToast

// CORREÇÃO: Remover props desnecessárias, o modal é auto-contido
interface AddTransactionModalProps {
  // open: boolean;
  // onOpenChange: (open: boolean) => void;
  // onAddTransaction: (transaction: any) => Promise<void>;
  // onAddInstallmentTransactions: (transactions: any[]) => Promise<void>;
  // accounts: Account[]; // Contas são obtidas do store
}

// Schema de validação do Zod (mantido)
const formSchema = z.object({
  type: z.enum(['expense', 'income']),
  description: z.string().min(1, 'A descrição é obrigatória.'),
  amount: z
    .number({ required_error: 'O valor é obrigatório.' })
    .min(1, 'O valor deve ser maior que R$ 0,00'),
  date: z.date({ required_error: 'A data é obrigatória.' }),
  accountId: z.string().uuid('A conta é obrigatória.'),
  categoryId: z.string().uuid().nullable(),
  isPaid: z.boolean(),
})

export const AddTransactionModal: React.FC<AddTransactionModalProps> = () => {
  const [isOpen, setIsOpen] = React.useState(false)

  const { toast } = useToast(); // CORREÇÃO: Usar useToast aqui
  const {
    accounts,
    categories,
    createTransaction,
  } = useAccountStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'expense',
      description: '',
      amount: undefined, 
      date: new Date(),
      accountId: undefined,
      categoryId: null,
      isPaid: true,
    },
  })

  // Filtra categorias com base no tipo
  const transactionType = form.watch('type')
  const filteredCategories = React.useMemo(() => {
    return categories.filter((c) => c.type === transactionType)
  }, [categories, transactionType])

  // Função chamada no submit
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    let amountInCents = values.amount
    if (values.type === 'expense') {
      amountInCents = -Math.abs(amountInCents)
    } else {
      amountInCents = Math.abs(amountInCents)
    }

    const dateString = format(values.date, 'yyyy-MM-dd')

    try {
      await createTransaction(
        {
          description: values.description,
          amount: amountInCents,
          date: dateString,
          account_id: values.accountId,
          category_id: values.categoryId,
          is_paid: values.isPaid,
        },
        () => {
          setIsOpen(false)
          form.reset()
        }
      )
      toast({ title: 'Sucesso', description: 'Transação adicionada com sucesso!' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao adicionar transação.', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nova Transação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Campo: Tipo (Receita/Despesa) */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo: Descrição */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Almoço, Salário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo: Valor (CORRIGIDO) */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <CurrencyInput
                  name="amount"
                  label="Valor"
                  placeholder="R$ 0,00"
                  field={field}
                />
              )}
            />

            {/* Campo: Data */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP', { locale: ptBR })
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo: Conta */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo: Categoria */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value || null)}
                    defaultValue={field.value || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">
                        <em>Nenhuma</em>
                      </SelectItem>
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo: Pago? */}
            <FormField
              control={form.control}
              name="isPaid"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Pago</FormLabel>
                    <span className="text-xs text-muted-foreground">
                      {field.value
                        ? 'Esta transação foi efetuada.'
                        : 'Esta é uma transação pendente.'}
                    </span>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button type="submit">Salvar Transação</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}