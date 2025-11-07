import { useAccountStore } from "@/stores/AccountStore";
import { AccountsPage } from "./AccountsPage";

export function AccountsPageWrapper() {
  const {
    accounts,
    addAccount,
    updateAccount,
    deleteAccount,
    createPayment,
    createTransfer,
  } = useAccountStore();

  return (
    <AccountsPage
      accounts={accounts}
      onAddAccount={addAccount}
      onEditAccount={updateAccount}
      onDeleteAccount={deleteAccount}
      onPayCreditCard={(amount, accountId, date) => createPayment({ amount, accountId, date })}
      onTransfer={(fromAccountId, toAccountId, amount, date) => createTransfer({ fromAccountId, toAccountId, amount, date: date.toISOString().split('T')[0] })}
    />
  );
}