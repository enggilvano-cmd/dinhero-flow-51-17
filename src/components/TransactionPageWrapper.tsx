import { useAccountStore } from "@/stores/AccountStore";
import { TransactionsPage } from "./TransactionsPage";
import { Transaction } from "@/types";

export function TransactionPageWrapper() {
  const {
    transactions,
    accounts,
    categories,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
  } = useAccountStore();

  return (
    <TransactionsPage
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      onAddTransaction={addTransaction}
      onEditTransaction={updateTransaction}
      onDeleteTransaction={deleteTransaction}
      onImportTransactions={(transactions: Transaction[]) => importTransactions(transactions)}
    />
  );
}