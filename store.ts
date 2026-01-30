import { AppState, BudgetAccount, Category, User } from './types';
import { DEFAULT_CATEGORIES } from './constants';

const STORAGE_KEY = 'zenbudget_state_v3';

export const generateId = () => Math.random().toString(36).substring(2, 11);

const isStorageAvailable = () => {
  try {
    const x = '__storage_test__';
    window.localStorage.setItem(x, x);
    window.localStorage.removeItem(x);
    return true;
  } catch (e) { return false; }
};

export const createDefaultAccount = (ownerId: string = 'local-user'): BudgetAccount => ({
  id: generateId(),
  name: 'Personnel',
  color: '#10b981',
  ownerId: ownerId,
  sharedWith: [],
  transactions: [],
  recurringTemplates: [],
  recurringSyncLog: [],
  deletedVirtualIds: [],
  monthlyBudget: 0,
  cycleEndDay: 28,
});

export const getInitialState = (): AppState => {
  const defaultUser: User = { id: 'local-user', email: 'local@zenbudget.app', name: 'Utilisateur Zen' };
  const defaultAcc = createDefaultAccount('local-user');
  
  const defaultState: AppState = {
    user: defaultUser,
    accounts: [defaultAcc],
    activeAccountId: defaultAcc.id,
    categories: DEFAULT_CATEGORIES,
    tasks: [],
    activeView: 'DASHBOARD'
  };

  if (!isStorageAvailable()) return defaultState;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState;
    const parsed = JSON.parse(saved);

    const savedCategories: Category[] = parsed.categories || [];
    const mergedCategories = [...DEFAULT_CATEGORIES];
    savedCategories.forEach(sc => {
      if (!mergedCategories.find(dc => dc.id === sc.id)) {
        mergedCategories.push(sc);
      }
    });

    const accounts = (parsed.accounts || [defaultAcc]).map((acc: any) => ({
      ...acc,
      transactions: acc.transactions || [],
      recurringTemplates: acc.recurringTemplates || [],
      deletedVirtualIds: acc.deletedVirtualIds || [],
      recurringSyncLog: acc.recurringSyncLog || [],
      cycleEndDay: acc.cycleEndDay ?? 28
    }));

    return { 
      ...defaultState, 
      ...parsed, 
      user: parsed.user || defaultUser,
      accounts: accounts,
      categories: mergedCategories,
      activeAccountId: accounts.find((a: any) => a.id === parsed.activeAccountId) ? parsed.activeAccountId : accounts[0].id
    };
  } catch (e) {
    console.error("Erreur de restauration du stockage local", e);
    return defaultState;
  }
};

export const saveState = (state: AppState) => {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
};