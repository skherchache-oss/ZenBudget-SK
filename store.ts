import { AppState, BudgetAccount, User } from './types';
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
    
    // Sécurité : on vérifie que le compte actif existe toujours dans la liste
    const activeExists = parsed.accounts?.some((a: BudgetAccount) => a.id === parsed.activeAccountId);

    return { 
      ...defaultState, 
      ...parsed, 
      user: defaultUser, // On garde l'utilisateur local par défaut
      activeAccountId: activeExists ? parsed.activeAccountId : (parsed.accounts?.[0]?.id || defaultAcc.id)
    };
  } catch (e) {
    console.error("Erreur de chargement du stockage local", e);
    return defaultState;
  }
};

export const saveState = (state: AppState) => {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Erreur lors de la sauvegarde", e);
  }
};