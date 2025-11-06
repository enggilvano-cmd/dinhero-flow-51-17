import { Account } from "@/types";

/**
 * Formata um valor numérico (em centavos) para uma string de moeda BRL.
 * @param valueInCents O valor em centavos.
 * @returns A string formatada, ex: "R$ 1.234,56".
 */
export function formatCurrency(valueInCents: number): string {
  const value = valueInCents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calcula o saldo disponível de uma conta, considerando o saldo principal e o limite.
 * @param account O objeto da conta.
 * @returns O saldo disponível em centavos.
 */
export function getAvailableBalance(account: Account | undefined): number {
  if (!account) return 0;
  return account.balance + (account.limit_amount || 0);
}