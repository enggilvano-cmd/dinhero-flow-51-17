import { Transaction, Account, TaxReport } from '@/types';
import { startOfYear, endOfYear, isWithinInterval } from 'date-fns';

export function generateTaxReport(
  transactions: Transaction[],
  accounts: Account[],
  year: number
): TaxReport {
  const startDate = startOfYear(new Date(year, 0, 1));
  const endDate = endOfYear(new Date(year, 0, 1));

  // Filtrar transações do ano
  const yearTransactions = transactions.filter(t => {
    const transactionDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
    return isWithinInterval(transactionDate, { start: startDate, end: endDate });
  });

  // Agrupar por categoria para receitas
  const incomeByCategory = yearTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      const categoryId = t.category_id || 'sem-categoria';
      if (!acc[categoryId]) {
        acc[categoryId] = {
          category_id: categoryId,
          category_name: 'Sem categoria',
          amount: 0,
          transactions: []
        };
      }
      acc[categoryId].amount += t.amount;
      acc[categoryId].transactions.push(t);
      return acc;
    }, {} as Record<string, { category_id: string; category_name: string; amount: number; transactions: Transaction[]; }>);

  // Agrupar por categoria para despesas
  const expensesByCategory = yearTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const categoryId = t.category_id || 'sem-categoria';
      if (!acc[categoryId]) {
        acc[categoryId] = {
          category_id: categoryId,
          category_name: 'Sem categoria',
          amount: 0,
          transactions: []
        };
      }
      acc[categoryId].amount += Math.abs(t.amount);
      acc[categoryId].transactions.push(t);
      return acc;
    }, {} as Record<string, { category_id: string; category_name: string; amount: number; transactions: Transaction[]; }>);

  // Calcular rendimentos de investimentos
  const investmentsByAccount = accounts
    .filter(a => a.type === 'investment')
    .map(account => {
      const initialBalance = account.initial_balance || 0;
      const finalBalance = account.balance;
      const earnings = finalBalance - initialBalance;

      return {
        account_id: account.id,
        account_name: account.name,
        initial_balance: initialBalance,
        final_balance: finalBalance,
        earnings
      };
    });

  return {
    year,
    income: {
      total: Object.values(incomeByCategory).reduce((sum, cat) => sum + cat.amount, 0),
      byCategory: Object.values(incomeByCategory)
    },
    expenses: {
      total: Object.values(expensesByCategory).reduce((sum, cat) => sum + cat.amount, 0),
      byCategory: Object.values(expensesByCategory)
    },
    investments: {
      total: investmentsByAccount.reduce((sum, inv) => sum + inv.earnings, 0),
      byAccount: investmentsByAccount
    }
  };
}

export function exportTaxReportToPDF(report: TaxReport): void {
  // Implementação da exportação para PDF do relatório fiscal
  // Esta é uma função placeholder que deve ser implementada com uma biblioteca de PDF
  console.log('Exportando relatório fiscal para PDF:', report);
}

// Função para validar documentos fiscais com base no tipo e no país
export function validateFiscalDocument(type: string, number: string, country: string = 'BR'): boolean {
  switch (country) {
    case 'BR': // Brasil
      return validateBrazilianDocument(type, number);
    case 'US': // Estados Unidos
      return validateUSDocument(type, number);
    case 'DE': // Alemanha
      return validateGermanDocument(type, number);
    default:
      throw new Error(`Validação para o país ${country} não implementada.`);
  }
}

// Validação de documentos brasileiros
function validateBrazilianDocument(type: string, number: string): boolean {
  if (type === 'CPF') {
    return validateCPF(number);
  } else if (type === 'CNPJ') {
    return validateCNPJ(number);
  }
  return false;
}

function validateCPF(cpf: string): boolean {
  const sanitized = cpf.replace(/\D/g, '');
  console.log('Validando CPF:', sanitized); // Log temporário
  if (sanitized.length !== 11 || /^\d{1}(\1{10})$/.test(sanitized)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(sanitized[i]) * (10 - i);
  }
  let checkDigit = (sum * 10) % 11;
  if (checkDigit === 10) checkDigit = 0; // Corrigido para ajustar valores maiores que 9
  console.log('Primeiro dígito verificador esperado:', checkDigit); // Log temporário
  if (checkDigit !== parseInt(sanitized[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(sanitized[i]) * (11 - i);
  }
  checkDigit = (sum * 10) % 11;
  if (checkDigit === 10) checkDigit = 0; // Corrigido para ajustar valores maiores que 9
  console.log('Segundo dígito verificador esperado:', checkDigit); // Log temporário
  return checkDigit === parseInt(sanitized[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const sanitized = cnpj.replace(/\D/g, '');
  console.log('Validando CNPJ:', sanitized); // Log temporário
  if (sanitized.length !== 14) return false;

  const validateDigits = (length: number) => {
    let sum = 0;
    let pos = length - 7;
    for (let i = 0; i < length; i++) {
      sum += parseInt(sanitized[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const checkDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    console.log(`Dígito verificador esperado para posição ${length}:`, checkDigit); // Log temporário
    return checkDigit === parseInt(sanitized[length]);
  };

  // Corrigir a validação para garantir que os dois dígitos verificadores sejam calculados corretamente
  const firstCheck = validateDigits(12);
  const secondCheck = validateDigits(13);
  console.log('Primeiro dígito verificador válido:', firstCheck); // Log temporário
  console.log('Segundo dígito verificador válido:', secondCheck); // Log temporário

  return firstCheck && secondCheck;
}

// Validação de documentos dos EUA
function validateUSDocument(type: string, number: string): boolean {
  if (type === 'SSN') {
    // SSN não pode começar com 000, 666 ou 900-999 e não pode conter 00 ou 0000 em partes específicas
    const regex = /^(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}$/;
    return regex.test(number);
  }
  return false;
}

// Validação de documentos alemães
function validateGermanDocument(type: string, number: string): boolean {
  if (type === 'Steuer-ID') {
    return /^\d{11}$/.test(number);
  }
  return false;
}