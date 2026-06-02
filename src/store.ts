import { AppState, BudgetAccount, Category, User, Transaction, RecurringTemplate } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { db } from './firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

// --- LOGIQUE DE SYNCHRONISATION ---
/**
 * Cette fonction prend une transaction et, si elle est récurrente, 
 * s'assure qu'un template existe dans les charges fixes.
 */
export const syncTransactionToRecurring = (account: BudgetAccount, tx: Transaction): BudgetAccount => {
  if (!tx.isRecurring) return account;

  // On vérifie si un template similaire existe déjà (même catégorie et montant)
  // pour éviter les doublons inutiles
  const exists = account.recurringTemplates.find(
    tpl => tpl.categoryId === tx.categoryId && tpl.amount === tx.amount && tpl.type === tx.type
  );

  if (exists) return account;

  // Création du nouveau template de charge fixe
  const newTemplate: RecurringTemplate = {
    id: `tpl-${generateId()}`,
    amount: tx.amount,
    type: tx.type,
    categoryId: tx.categoryId,
    comment: tx.comment,
    dayOfMonth: new Date(tx.date).getDate(),
    isActive: true
  };

  return {
    ...account,
    recurringTemplates: [...account.recurringTemplates, newTemplate]
  };
};

export const createDefaultAccount = (ownerId: string = 'local-user'): BudgetAccount => ({
  id: generateId(),
  name: 'Personnel',
  color: '#4F46E5', 
  ownerId: ownerId,
  sharedWith: [],
  transactions: [],
  recurringTemplates: [],
  recurringSyncLog: [],
  deletedVirtualIds: [],
  monthlyBudget: 0,
  cycleEndDay: 28,
});

const migrateData = (parsed: any, defaultState: AppState): AppState => {
  const savedCategories: Category[] = parsed.categories || [];
  const mergedCategories = [...DEFAULT_CATEGORIES];
  savedCategories.forEach(sc => {
    if (!mergedCategories.find(dc => dc.id === sc.id)) {
      mergedCategories.push(sc);
    }
  });

  const rawAccounts = Array.isArray(parsed.accounts) ? parsed.accounts : defaultState.accounts;
  const accounts = rawAccounts.map((acc: any) => {
    const rawTransactions: Transaction[] = acc.transactions || [];
    const uniqueTxMap = new Map();
    rawTransactions.forEach(tx => {
      if (tx.id) uniqueTxMap.set(tx.id, tx);
    });
    const cleanedTransactions = Array.from(uniqueTxMap.values());

    return {
      ...acc,
      transactions: cleanedTransactions,
      recurringTemplates: acc.recurringTemplates || [],
      deletedVirtualIds: acc.deletedVirtualIds || [],
      recurringSyncLog: acc.recurringSyncLog || [],
      cycleEndDay: acc.cycleEndDay ?? 28,
      color: acc.color || '#4F46E5',
      name: acc.name || 'Sans titre'
    };
  });

  return { 
    ...defaultState, 
    ...parsed, 
    user: parsed.user || defaultState.user,
    accounts: accounts,
    categories: mergedCategories,
    tasks: parsed.tasks || [],
    activeAccountId: accounts.find((a: any) => a.id === parsed.activeAccountId) 
      ? parsed.activeAccountId 
      : (accounts[0]?.id || defaultState.activeAccountId)
  };
};

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
    return migrateData(parsed, defaultState);
  } catch (e) {
    console.error("Erreur de restauration locale:", e);
    return defaultState;
  }
};

export const saveState = (state: AppState) => {
  if (!isStorageAvailable()) return;
  try {
    const { activeView, ...stateToSave } = state;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (e) {
    console.error("Erreur sauvegarde locale:", e);
  }
};

export const fetchUserData = async (firebaseUser: { uid: string, email: string | null, displayName: string | null, photoURL?: string | null }): Promise<AppState> => {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const currentUser: User = { 
    id: firebaseUser.uid, 
    email: firebaseUser.email || '', 
    name: firebaseUser.displayName || 'Utilisateur Zen',
    photoURL: firebaseUser.photoURL || undefined
  };
  
  const defaultAcc = createDefaultAccount(firebaseUser.uid);
  const defaultState: AppState = {
    user: currentUser,
    accounts: [defaultAcc],
    activeAccountId: defaultAcc.id,
    categories: DEFAULT_CATEGORIES,
    tasks: [],
    activeView: 'DASHBOARD'
  };

  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return migrateData(docSnap.data(), defaultState);
    } else {
      const localState = getInitialState();
      const migratedAccounts = localState.accounts.map(acc => ({
        ...acc,
        ownerId: firebaseUser.uid
      }));
      const stateToUpload: AppState = { 
        ...localState, 
        user: currentUser, 
        accounts: migratedAccounts 
      };
      await setDoc(userDocRef, stateToUpload);
      return stateToUpload;
    }
  } catch (error) {
    console.error("Erreur récupération Cloud:", error);
    return defaultState;
  }
};

export const saveUserData = async (userId: string, state: AppState) => {
  if (!userId || userId === 'local-user') return;
  try {
    const userDocRef = doc(db, 'users', userId);
    const { activeView, ...cloudData } = state;
    await setDoc(userDocRef, cloudData);
  } catch (error) {
    console.error("Erreur sauvegarde Cloud:", error);
  }
};