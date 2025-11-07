import { useAccountStore } from "@/stores/AccountStore";
import AnalyticsPage from "./AnalyticsPage";

export function AnalyticsPageWrapper() {
  const { accounts, transactions, categories } = useAccountStore();

  return (
    <AnalyticsPage
      accounts={accounts}
      transactions={transactions}
      categories={categories}
    />
  );
}