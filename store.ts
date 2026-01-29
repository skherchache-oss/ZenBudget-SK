
import { AppState, BudgetAccount, User, Category } from './types';
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
  monthlyBudget: 0,
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
  };

  if (!isStorageAvailable()) return defaultState;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState;
    const parsed = JSON.parse(saved);

    // SYNCHRONISATION DES CATÉGORIES
    // On s'assure que les catégories par défaut (Impôts, Épargne) sont présentes 
    // même si l'utilisateur a déjà une sauvegarde locale.
    const savedCategories: Category[] = parsed.categories || [];
    const mergedCategories = [...DEFAULT_CATEGORIES];
    
    savedCategories.forEach(sc => {
      if (!mergedCategories.find(dc => dc.id === sc.id)) {
        mergedCategories.push(sc);
      }
    });

    // Validation de l'ID de compte actif
    const accounts = parsed.accounts || [defaultAcc];
    const activeAccountId = accounts.find((a: any) => a.id === parsed.activeAccountId) 
      ? parsed.activeAccountId 
      : accounts[0].id;

    return { 
      ...defaultState, 
      ...parsed, 
      user: defaultUser,
      accounts: accounts,
      categories: mergedCategories,
      activeAccountId: activeAccountId 
    };
  } catch (e) {
    return defaultState;
  }
};

export const saveState = (state: AppState) => {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
};
