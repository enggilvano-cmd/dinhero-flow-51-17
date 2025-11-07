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
// Input não é mais usado diretamente para valor
// import { Input } from './ui/input'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { cn } from '@/lib/utils'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from './ui/calendar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Account, CreditBill } from '@/integrations/supabase/types'
import { useAccountStore } from '@/stores/AccountStore'
import { toast } from 'sonner'
// parseCurrencyToCents NÃO é mais necessário
// import { parseCurrencyToCents } from '@/lib/formatters'
import { supabase } from '@/integrations/supabase/client'
import { CurrencyInput } from './forms/CurrencyInput' // Importar o novo componente

interface CreditPaymentModalProps {
  creditAccount: Account
  bill: CreditBill
  onPaymentSuccess: () => void
}

// Schema de validação do Zod (CORRIGIDO)
const formSchema = z.object({
  accountId: z.string().uuid('Deve ser um ID de conta válido.'),
  // CORREÇÃO: 'amount' agora é um NÚMERO (centavos)
  amount: z
    .number({ required_error: 'O valor é obrigatório.' })
    .min(1, 'O valor deve ser maior que R$ 0,00'),
  date: z.date({ required_error: 'A data é obrigatória.' }),
})

export const CreditPaymentModal: React.FC<CreditPaymentModalProps> = ({
  creditAccount,
  bill,
  onPaymentSuccess,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const { accounts, loadAccounts } = useAccountStore()

  // Filtra contas que podem pagar (ex: não-crédito)
  const payingAccounts = React.useMemo(() => {
    return accounts.filter((acc) => acc.type !== 'credit_card')
  }, [accounts])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: undefined,
      // CORREÇÃO: O valor default é em CENTAVOS
      // bill.total_amount já vem em centavos (ex: -15000)
      amount: Math.abs(bill.total_amount),
      date: new Date(),
    },
  })

  // Função chamada no submit do formulário (CORRIGIDA)
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      //
      // === NOTA 10/10 DE CORREÇÃO ===
      // 1. 'values.amount' JÁ VEM EM CENTAVOS (ex: 15050)
      const amountInCents = values.amount

      // 2. Converte o objeto Date para a string 'YYYY-MM-DD'
      const dateString = format(values.date, 'yyyy-MM-dd')
      // ==============================
      //

      // 1. Cria a transação de DESPESA na conta de origem (ex: Conta Corrente)
      const { error: paymentError } = await supabase.from('transactions').insert({
        account_id: values.accountId,
        description: `Pagamento Fatura ${creditAccount.name}`,
        // Pagamento é uma despesa (negativo)
        amount: -Math.abs(amountInCents), // JÁ ESTÁ EM CENTAVOS
        date: dateString,
        category_id: null,
        include_in_reports: false, // Pagamento de fatura não conta em relatórios
        is_paid: true, // Pagamento de fatura é sempre 'pago'
      })

      if (paymentError) throw paymentError

      // 2. Cria a transação de RECEITA na conta de destino (Cartão de Crédito)
      const { error: creditError } = await supabase.from('transactions').insert({
        account_id: creditAccount.id,
        description: `Pagamento Recebido`,
        // Pagamento é uma receita (positivo) no cartão
        amount: Math.abs(amountInCents), // JÁ ESTÁ EM CENTAVOS
        date: dateString,
        category_id: null,
        include_in_reports: false,
        is_paid: true,
      })

      if (creditError) throw creditError

      // Sucesso
      toast.success('Pagamento da fatura registrado!')
      setIsOpen(false)
      loadAccounts() // Recarrega saldos
      onPaymentSuccess() // Recarrega faturas
    } catch (error: any) {
      console.error('Erro ao pagar fatura:', error)
      toast.error('Erro ao registrar pagamento.', {
        description: error.message,
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Pagar Fatura</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar Fatura - {creditAccount.name}</DialogTitle>
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
                    defaultValue={field.value}
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