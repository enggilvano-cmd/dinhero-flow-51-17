import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from './ui/button'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
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
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { cn } from '@/lib/utils'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from './ui/calendar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Account, CreditBill } from '@/integrations/supabase/types'
import { useAccountStore } from '@/stores/AccountStore'
import { useToast } from '@/hooks/use-toast'
import { CurrencyInput } from './CurrencyInput'

interface CreditPaymentModalProps {
  creditAccount: Account | null 
  bill: CreditBill | null 
  // CORREÇÃO: Adicionar onPayment como prop, que será a handlePayment da CreditBillsPage
  onPayment: (creditAccountId: string, bankAccountId: string, amountInCents: number, date: Date) => Promise<any>;
  onPaymentSuccess: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceValueInCents: number;
  nextInvoiceValueInCents: number;
}

// Schema de validação
const formSchema = z.object({
  accountId: z.string().uuid('Deve ser um ID de conta válido.'),
  amount: z
    .number({ required_error: 'O valor é obrigatório.' })
    .min(1, 'O valor deve ser maior que R$ 0,00'),
  date: z.date({ required_error: 'A data é obrigatória.' }),
})

export const CreditPaymentModal: React.FC<CreditPaymentModalProps> = ({
  creditAccount,
  bill,
  onPayment, // CORREÇÃO: Receber onPayment como prop
  onPaymentSuccess,
  invoiceValueInCents, // CORREÇÃO: Receber invoiceValueInCents
  nextInvoiceValueInCents, // CORREÇÃO: Receber nextInvoiceValueInCents
  open,
  onOpenChange,
}) => {
  const { accounts, loadAccounts } = useAccountStore()

  // Filtra contas que podem pagar
  const payingAccounts = React.useMemo(() => {
    return accounts.filter((acc) => acc.type !== 'credit_card')
  }, [accounts])

  const { toast } = useToast(); // CORREÇÃO: Usar useToast aqui
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    // CORREÇÃO: 'defaultValues' estático para evitar erro na inicialização
    defaultValues: {
      accountId: undefined,
      amount: undefined,
      date: new Date(),
    },
  })

  // Efeito para preencher o formulário quando o modal abre com uma fatura
  React.useEffect(() => {
    if (open && bill) {
      form.reset({
        accountId: undefined,
        amount: Math.abs(invoiceValueInCents), // CORREÇÃO: Usar invoiceValueInCents
        date: new Date(),
      })
    } else if (!open) {
      form.reset({
        accountId: undefined,
        amount: undefined,
        date: new Date(),
      })
    }
  }, [bill, open, form])

  // Função chamada no submit
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!creditAccount) {
      toast({ title: 'Erro', description: 'Conta de crédito não selecionada.', variant: 'destructive' }); // CORREÇÃO: Usar useToast
      return
    }

    try {
      // CORREÇÃO: Chamar a prop onPayment, que já lida com a lógica de transferência e atualização de fatura
      await onPayment(
        creditAccount.id,
        values.accountId,
        values.amount, // amount já está em centavos
        values.date
      );

      toast({ title: 'Sucesso', description: 'Pagamento da fatura registrado!', variant: 'default' }); // CORREÇÃO: Usar useToast
      onOpenChange(false)
      loadAccounts()
      onPaymentSuccess()
    } catch (error: any) {
      console.error('Erro ao pagar fatura:', error);
      toast({ title: 'Erro', description: error.message || 'Erro ao registrar pagamento.', variant: 'destructive' }); // CORREÇÃO: Usar useToast
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Pagar Fatura - {creditAccount?.name || 'Carregando...'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Campo: Conta de Origem */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pagar com</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''} 
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta de origem" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {payingAccounts.map((acc) => (
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

            {/* Campo: Valor (CORRIGIDO) */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <CurrencyInput
                  name="amount"
                  label="Valor do Pagamento"
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
                  <FormLabel>Data do Pagamento</FormLabel>
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
                          <CalendarIcon
                            className="ml-auto h-4 w-4 opacity-50"
                          />
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

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button type="submit">Confirmar Pagamento</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}