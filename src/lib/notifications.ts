// Notification utilities for reminders and alerts

export interface NotificationSettings {
  billReminders: boolean;
  transactionAlerts: boolean;
  budgetAlerts: boolean;
  dueDateReminders: number; // days before due date
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "reminder" | "alert" | "info";
  date: Date;
  read: boolean;
  actionType?: "bill_payment" | "budget_exceeded" | "account_low";
  actionData?: any;
}

// Check if browser supports notifications
export function canShowNotifications(): boolean {
  return "Notification" in window;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!canShowNotifications()) return false;
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
}

// Show system notification
export function showSystemNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === "granted") {
    return new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options
    });
  }
}

// Get due date reminders for credit cards
export function getDueDateReminders(accounts: any[], settings: NotificationSettings): Notification[] {
  const reminders: Notification[] = [];
  const today = new Date();
  const reminderDays = settings.dueDateReminders;
  
  accounts
    .filter(acc => acc.type === "credit" && acc.dueDate && acc.balance < 0)
    .forEach(account => {
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Calculate due date for current month
      const dueDate = new Date(currentYear, currentMonth, account.dueDate);
      
      // If due date has passed this month, calculate for next month
      if (dueDate < today) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }
      
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue <= reminderDays && daysUntilDue >= 0) {
        reminders.push({
          id: `due_${account.id}_${dueDate.getTime()}`,
          title: "Vencimento de Fatura",
          message: `A fatura do ${account.name} vence em ${daysUntilDue} dia(s). Valor: R$ ${Math.abs(account.balance).toFixed(2)}`,
          type: "reminder",
          date: today,
          read: false,
          actionType: "bill_payment",
          actionData: { accountId: account.id }
        });
      }
    });
  
  return reminders;
}

// Get low balance alerts
export function getLowBalanceAlerts(accounts: any[], threshold: number = 100): Notification[] {
  const alerts: Notification[] = [];
  const today = new Date();
  
  accounts
    .filter(acc => acc.type !== "credit" && acc.balance > 0 && acc.balance <= threshold)
    .forEach(account => {
      alerts.push({
        id: `low_balance_${account.id}_${today.getTime()}`,
        title: "Saldo Baixo",
        message: `A conta ${account.name} está com saldo baixo: R$ ${account.balance.toFixed(2)}`,
        type: "alert",
        date: today,
        read: false,
        actionType: "account_low",
        actionData: { accountId: account.id }
      });
    });
  
  return alerts;
}

// Format notification for display
export function formatNotificationTime(date: Date): string {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return "Agora";
  if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h atrás`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d atrás`;
  
  return date.toLocaleDateString('pt-BR');
}

// Schedule recurring notifications (would need a background service in production)
export function scheduleNotifications(accounts: any[], settings: NotificationSettings) {
  if (!settings.billReminders) return;
  
  const reminders = getDueDateReminders(accounts, settings);
  
  reminders.forEach(reminder => {
    // In a real app, you'd schedule these with a service worker
    // For demo purposes, we'll just log them
    console.log("Notification scheduled:", reminder.title, reminder.message);
  });
}

// Get all active notifications
export function getAllNotifications(accounts: any[], settings: NotificationSettings): Notification[] {
  const notifications: Notification[] = [];
  
  if (settings.billReminders) {
    notifications.push(...getDueDateReminders(accounts, settings));
  }
  
  if (settings.transactionAlerts) {
    notifications.push(...getLowBalanceAlerts(accounts));
  }
  
  return notifications.sort((a, b) => b.date.getTime() - a.date.getTime());
}