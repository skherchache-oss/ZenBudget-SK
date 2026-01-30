
export type TransactionType = 'INCOME' | 'EXPENSE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ViewType = 'DASHBOARD' | 'TRANSACTIONS' | 'RECURRING' | 'SETTINGS';

export interface User {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  budget?: number;
}

export interface Task {
  id: string;
  title: string;
  content: string;
  date: string; // ISO string
  categoryId: string;
  priority: Priority;
  isCompleted: boolean;
  isRecurring: boolean;
  tags: string[];
}

export interface Transaction {
  id: string;
  amount: number;
  date: string; // ISO string
  categoryId: string;
  comment?: string;
  type: TransactionType;
  isRecurring: boolean;
  templateId?: string; // ID du template d'origine pour la synchro
}

export interface RecurringTemplate {
  id: string;
  amount: number;
  categoryId: string;
  comment?: string;
  type: TransactionType;
  dayOfMonth: number;
  isActive: boolean;
}

export interface BudgetAccount {
  id: string;
  name: string;
  color: string;
  ownerId: string;
  sharedWith: string[];
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
  recurringSyncLog: string[];
  deletedVirtualIds?: string[]; // IDs des transactions virtuelles supprimées par l'utilisateur
  monthlyBudget: number;
  cycleEndDay?: number; // 0 ou undefined = fin du mois réel, sinon 1-31
}

export interface AppState {
  user: User | null;
  accounts: BudgetAccount[];
  activeAccountId: string;
  categories: Category[];
  tasks: Task[];
  activeView?: ViewType;
}
