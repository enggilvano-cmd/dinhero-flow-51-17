import { Transaction, Account } from '../types/index';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface CategoryReport {
  category: string;
  amount: number;
  percentage: number;
  transactions: number;
}

export interface MonthlyReport {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

export interface AccountReport {
  account: Account;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  balance: number;
}

export function generateCategoryReport(
  transactions: Transaction[],
  type: 'income' | 'expense',
  startDate: Date,
  endDate: Date,
  categories?: { id: string; name: string }[]
): CategoryReport[] {
  const filteredTransactions = transactions.filter(t => {
    const transactionDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
    return t.type === type && 
           isWithinInterval(transactionDate, { start: startDate, end: endDate });
  });

  const categoryTotals = filteredTransactions.reduce((acc, transaction) => {
    // Handle both category and category_id properties
    let categoryName = (transaction as any).category;
    if (!categoryName && transaction.category_id && categories) {
      const category = categories.find(cat => cat.id === transaction.category_id);
      categoryName = category?.name || 'Categoria não encontrada';
    }
    if (!categoryName) {
      categoryName = 'Sem categoria';
    }
    acc[categoryName] = (acc[categoryName] || 0) + transaction.amount;
    return acc;
  }, {} as Record<string, number>);

  const totalAmount = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);

  return Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      transactions: filteredTransactions.filter(t => {
        let tCategoryName = (t as any).category;
        if (!tCategoryName && t.category_id && categories) {
          const tCategory = categories.find(cat => cat.id === t.category_id);
          tCategoryName = tCategory?.name || 'Categoria não encontrada';
        }
        if (!tCategoryName) {
          tCategoryName = 'Sem categoria';
        }
        return tCategoryName === category;
      }).length
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function generateMonthlyReport(
  transactions: Transaction[],
  monthsBack = 12
): MonthlyReport[] {
  const reports: MonthlyReport[] = [];
  
  for (let i = 0; i < monthsBack; i++) {
    const targetDate = subMonths(new Date(), i);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    
    const monthTransactions = transactions.filter(t => {
      const transactionDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
      return isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
    });
    
    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    reports.unshift({
      month: format(targetDate, 'MMM yyyy', { locale: ptBR }),
      income,
      expenses,
      balance: income - expenses
    });
  }
  
  return reports;
}

export function generateAccountReport(
  accounts: Account[],
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): AccountReport[] {
  return accounts.map(account => {
    const accountTransactions = transactions.filter(t => {
      const transactionDate = typeof t.date === 'string' ? new Date(t.date) : t.date;
      const accountId = (t as any).accountId || t.account_id;
      return accountId === account.id && 
             isWithinInterval(transactionDate, { start: startDate, end: endDate });
    });
    
    const totalIncome = accountTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = accountTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      account,
      totalIncome,
      totalExpenses,
      transactionCount: accountTransactions.length,
      balance: account.balance
    };
  });
}

export function exportToCSV(data: any[], filename: string): void {
  if (!data.length) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle dates, numbers, and strings
        if (value instanceof Date) {
          return `"${format(value, 'dd/MM/yyyy')}"`;
        }
        if (typeof value === 'number') {
          return value.toString();
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

export function exportToPDF(data: any[], title: string): void {
  // For now, we'll create a printable HTML version
  // In a real app, you'd integrate with a PDF library like jsPDF
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .header { text-align: center; margin-bottom: 30px; }
        .date { color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <p class="date">Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
      </div>
      <table>
        <thead>
          <tr>
            ${Object.keys(data[0] || {}).map(key => `<th>${key}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${Object.values(row).map(value => {
                if (value instanceof Date) {
                  return `<td>${format(value, 'dd/MM/yyyy')}</td>`;
                }
                if (typeof value === 'number') {
                  return `<td>${value.toLocaleString('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  })}</td>`;
                }
                return `<td>${String(value)}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}