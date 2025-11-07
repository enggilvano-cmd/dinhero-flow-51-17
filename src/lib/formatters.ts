/**
 * NOTA DO CONTADOR:
 * Este é o "tradutor" entre o formato do usuário (ex: "R$ 10,50")
 * e o formato do banco de dados (ex: 1050).
 */

// IMPORTAÇÃO ADICIONADA: A nova função precisa do tipo 'Account'
import { Account } from '@/types'

/**
 * Formata um valor inteiro em centavos para uma string de moeda BRL.
 * @param amountInCents O valor em centavos (ex: 1050)
 * @returns A string formatada (ex: "R$ 10,50")
 */
export const formatCurrency = (
  amountInCents: number | null | undefined
): string => {
  if (amountInCents === null || amountInCents === undefined) {
    amountInCents = 0
  }

  // Converte centavos (inteiro) para a unidade principal (decimal)
  const amount = amountInCents / 100

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(amount)
}

// NOTA DO PROGRAMADOR:
// Esta função foi movida de `src/lib/utils.ts` para centralizar a lógica de formatação/parsing de moeda.
/**
 * Converte uma string de moeda formatada (ou um número) para um inteiro em centavos.
 * Esta versão é mais robusta e lida com prefixos (R$), espaços e múltiplos separadores.
 * @returns {number} O valor em centavos como um inteiro, ou NaN se a entrada for inválida.
 */
export function currencyStringToCents(value: string | number): number {
  if (typeof value === 'number') {
    // Arredonda para garantir que estamos trabalhando com 2 casas decimais
    return Math.round(value * 100);
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return NaN;
  }

  // 1. Remove tudo que não for dígito, vírgula ou sinal de menos
  // Remove prefixos (R$), espaços e todos os separadores de milhar (pontos).
  // Substitui a última vírgula por um ponto para o parseFloat.
  const cleanedValue = value.trim().replace(/R\$\s*/, '');

  // Verifica se há vírgula como separador decimal
  const lastCommaIndex = cleanedValue.lastIndexOf(',');
  const lastDotIndex = cleanedValue.lastIndexOf('.');

  let sanitizedValue = cleanedValue.replace(/\./g, ''); // Remove todos os pontos
  if (lastCommaIndex > lastDotIndex) {
    sanitizedValue = sanitizedValue.replace(',', '.'); // Substitui a vírgula decimal por ponto
  }

  // 2. Converte para número e valida.
  const numericValue = parseFloat(sanitizedValue.replace(/[^0-9.-]/g, ''));
  if (isNaN(numericValue)) {
    return NaN;
  }

  // 3. Converte para centavos e arredonda para evitar erros de ponto flutuante.
  return Math.round(numericValue * 100);
}

/**
 * FUNÇÃO ADICIONADA (ESTAVA FALTANDO)
 * Calcula o saldo disponível (saldo + limite) de uma conta.
 * @param account O objeto da conta
 * @returns O saldo disponível em centavos (ex: 10050)
 */
export const getAvailableBalance = (
  account: Account | null | undefined
): number => {
  if (!account) {
    return 0
  }

  // O limite (cheque especial) é um valor positivo que se soma ao saldo.
  const limit = account.limit_amount || 0

  // O saldo (balance) já está em centavos.
  return account.balance + limit
}