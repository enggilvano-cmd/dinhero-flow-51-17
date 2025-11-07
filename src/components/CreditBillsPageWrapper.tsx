import { useAccountStore } from "@/stores/AccountStore";
import { CreditBillsPage } from "./CreditBillsPage";

export function CreditBillsPageWrapper() {
  const { accounts, transactions } = useAccountStore();

  return (
    <CreditBillsPage
      accounts={accounts}
      transactions={transactions}
    />
  );
}