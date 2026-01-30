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
  };

  if (!isStorageAvailable()) return defaultState;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState;
    
    const parsed = JSON.parse(saved);

    // Protection : si parsed n'est pas un objet ou n'a pas d'accounts, on reset
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.accounts)) {
      return defaultState;
    }

    // Fusion sécurisée des catégories
    const savedCategories: Category[] = Array.isArray(parsed.categories) ? parsed.categories : [];
    const mergedCategories = [...DEFAULT_CATEGORIES];
    savedCategories.forEach(sc => {
      if (sc && sc.id && !mergedCategories.find(dc => dc.id === sc.id)) {
        mergedCategories.push(sc);
      }
    });

    // Nettoyage et validation des comptes
    const accounts = parsed.accounts.map((acc: any) => ({
      ...createDefaultAccount(defaultUser.id), // Valeurs par défaut
      ...acc, // Écrase avec les données sauvegardées
      transactions: Array.isArray(acc.transactions) ? acc.transactions : [],
      recurringTemplates: Array.isArray(acc.recurringTemplates) ? acc.recurringTemplates : [],
      deletedVirtualIds: Array.isArray(acc.deletedVirtualIds) ? acc.deletedVirtualIds : [],
      cycleEndDay: (acc.cycleEndDay && acc.cycleEndDay > 0) ? acc.cycleEndDay : 28
    }));

    const activeId = accounts.find((a: any) => a.id === parsed.activeAccountId) 
      ? parsed.activeAccountId 
      : accounts[0].id;

    return { 
      ...defaultState, 
      ...parsed, 
      user: defaultUser,
      accounts: accounts,
      categories: mergedCategories,
      activeAccountId: activeId
    };
  } catch (e) {
    console.error("Crash Store - Retour aux valeurs par défaut", e);
    return defaultState;
  }
};

export const saveState = (state: AppState) => {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Erreur de sauvegarde", e);
  }
};