import { Account } from "@/types";
import { formatCurrency, getAvailableBalance } from "@/lib/formatters";

interface AccountBalanceDetailsProps {
  account: Account | undefined | null;
}

export function AccountBalanceDetails({ account }: AccountBalanceDetailsProps) {
  if (!account) {
    return null;
  }

  return (
    <p className="text-sm text-muted-foreground">
      Saldo disponível: {formatCurrency(getAvailableBalance(account))}
      {account.limit_amount && account.limit_amount > 0 ? (
        <span className="block text-xs text-blue-600">
          (Saldo: {formatCurrency(account.balance)} + Limite: {formatCurrency(account.limit_amount)})
        </span>
      ) : null}
    </p>
  );
}