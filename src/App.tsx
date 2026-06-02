import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, ViewType, Transaction } from './types';
import { getInitialState, saveState, generateId, fetchUserData, saveUserData, syncTransactionToRecurring } from './store';
import { MONTHS_FR } from './constants';
import { IconPlus, IconHome, IconCalendar, IconSettings } from './components/Icons';

// Firebase & Auth
import { auth, loginWithGoogle, logout, db } from './firebase'; 
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

import Dashboard from './components/Dashboard';
import RecurringManager from './components/RecurringManager';
import TransactionList from './components/TransactionList';
import AddTransactionModal from './components/AddTransactionModal';
import Settings from './components/Settings';
import AuthScreen from './components/AuthScreen';

const VIEW_ORDER: ViewType[] = ['DASHBOARD', 'TRANSACTIONS', 'RECURRING', 'SETTINGS'];

const App: React.FC = () => {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, setState] = useState<AppState>(() => getInitialState());
  const [activeView, setActiveView] = useState<ViewType>('DASHBOARD');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(new Date().toISOString());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [showWelcome, setShowWelcome] = useState(false);
  const [viewDirection, setViewDirection] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const isImporting = useRef(false);

  const changeMonth = (offset: number) => {
    setSlideDirection(offset > 0 ? 'next' : 'prev');
    let nextMonth = currentMonth + offset;
    let nextYear = currentYear;

    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    } else if (nextMonth < 0) {
      nextMonth = 11;
      nextYear--;
    }

    setCurrentMonth(nextMonth);
    setCurrentYear(nextYear);
    setSelectedDay(null);
  };

  useEffect(() => {
    const handlePopState = () => {
      if (showAddModal) {
        setShowAddModal(false);
        setEditingTransaction(null);
      }
    };

    if (showAddModal) {
      window.history.pushState({ modalOpen: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [showAddModal]);

  const openAddModal = (date?: string, editItem?: Transaction | null) => {
    setEditingTransaction(editItem || null);

    if (date) {
      setModalInitialDate(date);
    } else if (!editItem) {
      if (selectedDay) {
        const d = new Date(currentYear, currentMonth, selectedDay, 12);
        setModalInitialDate(d.toISOString());
      } else {
        setModalInitialDate(new Date().toISOString());
      }
    }

    setShowAddModal(true);
  };

  const sanitizeForFirebase = (obj: any) => JSON.parse(JSON.stringify(obj));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);

      if (firebaseUser) {
        const cloudData = await fetchUserData(firebaseUser);

        if (cloudData?.accounts) {
          setState({
            ...cloudData,
            user: {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Utilisateur',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || null
            }
          });
        } else {
          const initialState = getInitialState();

          const userProfile = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Utilisateur',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || null
          };

          await setDoc(doc(db, "users", firebaseUser.uid), sanitizeForFirebase({
            ...initialState,
            user: userProfile
          }));

          setState({ ...initialState, user: userProfile });
          setShowWelcome(true);
        }

        setFbUser(firebaseUser);
      } else {
        setFbUser(null);
        setState(getInitialState());
      }

      setAuthLoading(false);
      setTimeout(() => setIsInitializing(false), 1000);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isInitializing || authLoading || isImporting.current) return;

    saveState(state);

    if (fbUser && fbUser.uid !== 'local-user') {
      saveUserData(fbUser.uid, sanitizeForFirebase(state));
    }
  }, [state, fbUser, authLoading, isInitializing]);

  const handleUpdateUser = (updatedUser: { name?: string; photoURL?: string | null }) => {
    setState(prev => ({
      ...prev,
      user: {
        ...prev.user,
        ...(updatedUser.name && { name: updatedUser.name }),
        ...(updatedUser.photoURL !== undefined && { photoURL: updatedUser.photoURL })
      }
    }));
  };

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const paidMarkers = useMemo(() => {
    if (!activeAccount) return new Set<string>();

    return new Set(
      activeAccount.transactions
        .filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .map(t => `${t.comment.toLowerCase().trim()}-${t.amount}`)
    );
  }, [activeAccount, currentMonth, currentYear]);

  const getBalanceAtDate = (targetDate: Date, includeProjections: boolean) => {
    if (!activeAccount) return 0;

    const normalized = new Date(targetDate);
    normalized.setHours(23,59,59,999);

    let balance = activeAccount.transactions.reduce((acc, t) => {
      const d = new Date(t.date);
      d.setHours(0,0,0,0);
      return d <= normalized ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    return balance;
  };

  const projectedBalance = useMemo(
    () => getBalanceAtDate(new Date(currentYear, currentMonth + 1, 0), true),
    [activeAccount, currentMonth, currentYear]
  );

  const carryOver = useMemo(
    () => getBalanceAtDate(new Date(currentYear, currentMonth, 0), false),
    [activeAccount, currentMonth, currentYear]
  );

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];

    const real = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    return real.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear]);

  const handleUpsertTransaction = async (t: Omit<Transaction,'id'> & { id?: string }) => {
    const accIndex = state.accounts.findIndex(a => a.id === state.activeAccountId);
    if (accIndex === -1) return;

    const acc = { ...state.accounts[accIndex] };

    let nextTx = [...acc.transactions];

    const finalTx: Transaction = {
      ...t,
      id: t.id || generateId()
    } as Transaction;

    nextTx = [finalTx, ...nextTx];

    acc.transactions = nextTx;

    const newAccounts = [...state.accounts];
    newAccounts[accIndex] = acc;

    setState({ ...state, accounts: newAccounts });
    setShowAddModal(false);
    setEditingTransaction(null);
  };

  const handleViewChange = (v: ViewType) => setActiveView(v);

  const handleFeedbackCapture = async (data: any) => {
    setState(prev => ({ ...prev, hasGivenFeedback: true, feedbackData: data }));

    if (fbUser && fbUser.uid !== 'local-user') {
      await addDoc(collection(db, "all_feedbacks"), {
        userId: fbUser.uid,
        ...data,
        submittedAt: new Date().toISOString()
      });

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleUpdateCycleDay = (day: number) => {
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(a =>
        a.id === prev.activeAccountId ? { ...a, cycleEndDay: day } : a
      )
    }));
  };

  const headerPhoto =
    (fbUser && localStorage.getItem(`user_photo_hd_${fbUser.uid}`)) ||
    state.user?.photoURL;

  if (authLoading) return <div className="p-10 text-white">Loading...</div>;

  if (!fbUser)
    return <AuthScreen onLocalMode={() => setFbUser({ uid: 'local-user' } as any)} />;

  return (
    <div className="min-h-screen bg-slate-950 text-black">

      <header className="p-4 flex justify-between">
        <h1>ZenBudget</h1>
      </header>

      <main>
        <AnimatePresence mode="wait">
          <motion.div key={activeView}>
            {activeView === 'DASHBOARD' && (
              <Dashboard transactions={effectiveTransactions} />
            )}

            {activeView === 'TRANSACTIONS' && (
              <TransactionList transactions={effectiveTransactions} />
            )}

            {activeView === 'RECURRING' && (
              <RecurringManager />
            )}

            {activeView === 'SETTINGS' && (
              <Settings />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <button onClick={() => openAddModal()}>+</button>

      {showAddModal && (
        <AddTransactionModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleUpsertTransaction}
        />
      )}

      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-0 right-0 flex justify-center"
          >
            <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center gap-3">
              <span>🙏</span>
              <span>Merci pour votre retour !</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default App;