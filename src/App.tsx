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
  
  // État pour le message de remerciement
  const [showToast, setShowToast] = useState(false);

  const [isInitializing, setIsInitializing] = useState(true);
  const isImporting = useRef(false);

  // --- LOGIQUE DE CHANGEMENT DE MOIS ---
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

  // --- LOGIQUE BOUTON RETOUR ANDROID / MOBILE BROWSER ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (showAddModal) {
        setShowAddModal(false);
        setEditingTransaction(null);
      }
    };

    if (showAddModal) {
      window.history.pushState({ modalOpen: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showAddModal]);

  const openAddModal = (date?: string, editItem?: Transaction | null) => {
    if (editItem) {
      setEditingTransaction(editItem);
    } else {
      setEditingTransaction(null);
    }
    
    if (date) {
      setModalInitialDate(date);
    } else if (!editItem) {
      if (selectedDay) {
        const d = new Date(currentYear, currentMonth, selectedDay, 12, 0, 0);
        setModalInitialDate(d.toISOString());
      } else {
        setModalInitialDate(new Date().toISOString());
      }
    }
    
    setShowAddModal(true);
  };

  const sanitizeForFirebase = (obj: any): any => JSON.parse(JSON.stringify(obj));

  // --- SYNCHRONISATION AUTH & INITIALISATION FIRESTORE ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        const cloudData = await fetchUserData(firebaseUser);
        
        if (cloudData && cloudData.accounts) {
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

          try {
            await setDoc(doc(db, "users", firebaseUser.uid), sanitizeForFirebase({
              ...initialState,
              user: userProfile
            }));
            setState({ ...initialState, user: userProfile });
            setShowWelcome(true);
          } catch (error) {
            console.error("Erreur lors de la création du profil Firestore:", error);
          }
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

  // --- SAUVEGARDE AUTO ---
  useEffect(() => {
    if (isInitializing || authLoading || isImporting.current) return;
    saveState(state);
    if (fbUser && fbUser.uid && fbUser.uid !== 'local-user') {
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
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const paidMarkers = useMemo(() => {
    if (!activeAccount) return new Set();
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
    const normalizedTarget = new Date(targetDate);
    normalizedTarget.setHours(23, 59, 59, 999);
    
    let balance = activeAccount.transactions.reduce((acc, t) => {
      const tDate = new Date(t.date);
      tDate.setHours(0, 0, 0, 0); 
      return tDate <= normalizedTarget ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    if (includeProjections) {
      const templates = activeAccount.recurringTemplates || [];
      const deletedIds = new Set(activeAccount.deletedVirtualIds || []);
      templates.forEach(tpl => {
        if (!tpl.isActive) return;
        const marker = `${tpl.comment?.toLowerCase().trim() || ''}-${tpl.amount}`;
        if (paidMarkers.has(marker)) return;
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        const vDate = new Date(currentYear, currentMonth, day, 0, 0, 0);
        const vId = `virtual-${tpl.id}-${currentMonth}-${currentYear}`;
        if (vDate <= normalizedTarget && !deletedIds.has(vId)) {
          balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
        }
      });
    }
    return balance;
  };

  const projectedBalance = useMemo(() => getBalanceAtDate(new Date(currentYear, currentMonth + 1, 0), true), [activeAccount, currentMonth, currentYear, paidMarkers]);
  const carryOver = useMemo(() => getBalanceAtDate(new Date(currentYear, currentMonth, 0), false), [activeAccount, currentMonth, currentYear]);

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    const realOnes = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const deletedIds = new Set(activeAccount.deletedVirtualIds || []);
    const virtuals = (activeAccount.recurringTemplates || [])
      .filter(tpl => {
        const marker = `${tpl.comment?.toLowerCase().trim() || ''}-${tpl.amount}`;
        return tpl.isActive && !paidMarkers.has(marker);
      })
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        const vId = `virtual-${tpl.id}-${currentMonth}-${currentYear}`;
        return {
          id: vId, amount: tpl.amount, type: tpl.type, categoryId: tpl.categoryId,
          comment: tpl.comment || (tpl.type === 'INCOME' ? 'Revenu fixe' : 'Charge fixe'),
          date: new Date(currentYear, currentMonth, day, 0, 0, 0).toISOString(),
          isRecurring: true, templateId: tpl.id
        } as Transaction;
      }).filter(v => !deletedIds.has(v.id));
    return [...realOnes, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear, paidMarkers]);

  const handleUpsertTransaction = async (t: Omit<Transaction, 'id'> & { id?: string }) => {
    const accIndex = state.accounts.findIndex(a => a.id === state.activeAccountId);
    if (accIndex === -1) return;
    
    let acc = { ...state.accounts[accIndex] };
    let nextTx = [...acc.transactions];
    let nextDeleted = [...(acc.deletedVirtualIds || [])];
    const targetId = t.id || editingTransaction?.id;
    
    let finalTx: Transaction;

    if (targetId?.startsWith('virtual-')) {
      nextDeleted.push(targetId!);
      finalTx = { ...t, id: generateId(), templateId: targetId.split('-')[1] } as Transaction;
      nextTx = [finalTx, ...nextTx];
    } else if (targetId && nextTx.some(i => i.id === targetId)) {
      finalTx = { ...t, id: targetId } as Transaction;
      nextTx = nextTx.map(i => i.id === targetId ? finalTx : i);
    } else {
      finalTx = { ...t, id: generateId() } as Transaction;
      nextTx = [finalTx, ...nextTx];
    }
    
    acc.transactions = nextTx;
    acc.deletedVirtualIds = nextDeleted;
    acc = syncTransactionToRecurring(acc, finalTx);
    
    const nextAccounts = [...state.accounts];
    nextAccounts[accIndex] = acc;
    
    const newState = { ...state, accounts: nextAccounts };
    setState(newState);
    setShowAddModal(false); 
    setEditingTransaction(null);
  };

  const handleViewChange = (newView: ViewType) => {
    if (newView !== activeView) {
      const currentIndex = VIEW_ORDER.indexOf(activeView);
      const nextIndex = VIEW_ORDER.indexOf(newView);
      setViewDirection(nextIndex > currentIndex ? 1 : -1);
      setActiveView(newView);
    }
  };

  const handleFeedbackCapture = async (data: any) => {
    setState(prev => ({ 
      ...prev, 
      hasGivenFeedback: true,
      feedbackData: data
    }));

    if (fbUser && fbUser.uid !== 'local-user') {
      try {
        await addDoc(collection(db, "all_feedbacks"), {
          userId: fbUser.uid,
          userEmail: fbUser.email,
          userName: fbUser.displayName,
          ...data,
          submittedAt: new Date().toISOString()
        });
        
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } catch (e) {
        console.error("Erreur feedback global:", e);
      }
    }
  };

  const handleUpdateCycleDay = (day: number) => {
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc => 
        acc.id === prev.activeAccountId 
          ? { ...acc, cycleEndDay: day } 
          : acc
      )
    }));
  };

  const headerPhoto = (fbUser && fbUser.uid !== 'local-user' && localStorage.getItem(`user_photo_hd_${fbUser.uid}`)) || state.user?.photoURL;

  if (authLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-950 gap-8">
      <style>{`
        @keyframes shine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .text-shine {
          background: linear-gradient(90deg, #4f46e5 0%, #ffffff 50%, #4f46e5 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shine 3s linear infinite;
        }
      `}</style>
      
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ 
          scale: [1, 1.05, 1],
          opacity: 1 
        }}
        transition={{ 
          scale: { repeat: Infinity, duration: 3, ease: "easeInOut" },
          opacity: { duration: 0.5 }
        }}
        className="relative"
      >
        <img 
          src="/ZB-logo-192.png" 
          alt="ZenBudget" 
          className="w-28 h-28 rounded-[32px] shadow-[0_0_60px_rgba(79,70,229,0.4)] border border-white/10"
        />
      </motion.div>
      
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-4xl font-black tracking-[0.25em] uppercase italic text-shine">
          ZenBudget
        </h1>
        <div className="flex gap-2.5">
          <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}
            className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.8)]"
          />
          <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
            className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.8)]"
          />
          <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
            className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.8)]"
          />
        </div>
      </div>
    </div>
  );

  if (!fbUser) return <AuthScreen onLocalMode={() => { setFbUser({ uid: 'local-user', displayName: 'Invité' } as any); setShowWelcome(true); }} />;

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center overflow-hidden font-sans bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="w-full max-w-[768px] bg-[#F8F9FD] flex flex-col h-screen relative shadow-[0_0_80px_rgba(0,0,0,0.6)] border-x border-white/5">
        
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 shrink-0 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
               <div className="relative">
                 <img 
                   src="/ZB-logo-192.png" 
                   alt="ZenBudget" 
                   className="w-8 h-8 rounded-lg shadow-sm border border-slate-200"
                 />
               </div>
               <h1 className="text-xl font-black tracking-tighter italic text-slate-900">ZenBudget</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div 
                onClick={() => handleViewChange('SETTINGS')} 
                className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden cursor-pointer active:scale-90 transition-transform bg-slate-50 flex items-center justify-center"
              >
                {headerPhoto ? (
                  <img src={headerPhoto} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-black text-indigo-600">
                    {fbUser?.displayName?.charAt(0) || 'Z'}
                  </span>
                )}
              </div>
              
              <button onClick={() => setShowWelcome(true)} className="text-slate-300 hover:text-indigo-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="popLayout" custom={viewDirection} initial={false}>
            <motion.div
              key={activeView} custom={viewDirection}
              variants={{ enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (dir: number) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0 }) }}
              initial="enter" animate="center" exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="absolute inset-0 px-6 pt-6 pb-28 overflow-y-auto no-scrollbar"
            >
              {activeView === 'DASHBOARD' && (
                <Dashboard 
                  transactions={effectiveTransactions} categories={state.categories} activeAccount={activeAccount} allAccounts={state.accounts}
                  onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} month={currentMonth} year={currentYear}
                  onViewTransactions={() => handleViewChange('TRANSACTIONS')} checkingAccountBalance={getBalanceAtDate(now, false)} 
                  availableBalance={getBalanceAtDate(new Date(currentYear, currentMonth, activeAccount?.cycleEndDay || 26), true)} projectedBalance={projectedBalance} carryOver={carryOver}
                  onAddTransaction={handleUpsertTransaction}
                  onPrevMonth={() => changeMonth(-1)}
                  onNextMonth={() => changeMonth(1)}
                />
              )}
              {activeView === 'TRANSACTIONS' && (
                <TransactionList 
                  transactions={effectiveTransactions} categories={state.categories} month={currentMonth} year={currentYear}
                  onDelete={(id) => setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, transactions: a.transactions.filter(tx => tx.id !== id), deletedVirtualIds: id.startsWith('virtual-') ? [...(a.deletedVirtualIds || []), id] : a.deletedVirtualIds } : a) }))}
                  onEdit={(t) => openAddModal(undefined, t)}
                  onAddAtDate={(date) => openAddModal(date)}
                  selectedDay={selectedDay} onSelectDay={setSelectedDay} totalBalance={projectedBalance} carryOver={carryOver} cycleEndDay={activeAccount?.cycleEndDay || 0}
                  onMonthChange={(offset) => changeMonth(offset)} 
                  slideDirection={slideDirection}
                />
              )}
              {activeView === 'RECURRING' && (
                <RecurringManager 
                  recurringTemplates={activeAccount?.recurringTemplates || []} 
                  categories={state.categories}
                  onUpdate={(templates) => setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, recurringTemplates: templates } : a) }))}
                  totalBalance={projectedBalance}
                  month={currentMonth}
                  year={currentYear}
                  onMonthChange={(offset) => changeMonth(offset)}
                />
              )}
              {activeView === 'SETTINGS' && (
                <Settings 
                  state={state} user={fbUser}
                  onUpdateAccounts={(accs) => setState(prev => ({ ...prev, accounts: accs }))}
                  onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
                  onUpdateUser={handleUpdateUser} 
                  onDeleteAccount={(id) => {
                    setState(prev => {
                      const nextAccounts = prev.accounts.filter(a => a.id !== id);
                      if (nextAccounts.length === 0) return prev;
                      return { ...prev, accounts: nextAccounts, activeAccountId: prev.activeAccountId === id ? nextAccounts[0].id : prev.activeAccountId };
                    });
                  }}
                  onReset={async () => { 
                    if(confirm("Tout supprimer ?")) { 
                      setIsInitializing(true);
                      const freshState = getInitialState();
                      localStorage.removeItem('zenbudget_state_v3');
                      if (fbUser) {
                        localStorage.removeItem(`user_photo_hd_${fbUser.uid}`);
                        await saveUserData(fbUser.uid, sanitizeForFirebase(freshState));
                      }
                      setState(freshState);
                      setTimeout(() => window.location.reload(), 200);
                    } 
                  }}
                  // --- LOGIQUE CATÉGORIES ---
                  onAddCategory={(newCat) => {
                    const categoryWithId = { ...newCat, id: generateId() };
                    setState(prev => ({ ...prev, categories: [...prev.categories, categoryWithId] }));
                  }}
                  onUpdateCategory={(id, updatedData) => {
                    setState(prev => ({ ...prev, categories: prev.categories.map(c => c.id === id ? { ...c, ...updatedData } : c) }));
                  }}
                  onDeleteCategory={(id) => {
                    setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
                  }}
                  onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))} 
                  // --------------------------
                  onUpdateBudget={handleUpdateCycleDay} onLogin={loginWithGoogle} onLogout={logout} onShowWelcome={() => setShowWelcome(true)}
                  onBackup={() => { 
                    const dataStr = JSON.stringify(state); 
                    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr); 
                    const accountName = activeAccount?.name || state.user.name || 'mon';
                    const fileName = `zenbudget_${accountName.toLowerCase().replace(/\s+/g, '_')}_backup.json`;
                    const link = document.createElement('a'); 
                    link.setAttribute('href', dataUri); 
                    link.setAttribute('download', fileName); 
                    link.click(); 
                  }} 
                  onImport={(file) => { 
                    const reader = new FileReader(); 
                    reader.onload = async (e) => { 
                      try { 
                        const imported = JSON.parse(e.target?.result as string);
                        isImporting.current = true;
                        setIsInitializing(true);
                        setState({ ...imported, user: state.user });
                        alert("Import réussi !");
                        window.location.reload();
                      } catch (err) { alert("Fichier invalide"); } 
                    }; 
                    reader.readAsText(file); 
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <button onClick={() => openAddModal()} className="absolute bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center active:scale-95 z-40 border-4 border-white"><IconPlus className="w-7 h-7" /></button>

        <nav className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 grid grid-cols-4 items-center pt-3 pb-8 px-2 z-40">
          <NavBtn active={activeView === 'DASHBOARD'} onClick={() => handleViewChange('DASHBOARD')} icon={<IconHome />} label="Board" fullLabel="Board" />
          <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => handleViewChange('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" fullLabel="Journal" />
          <NavBtn active={activeView === 'RECURRING'} onClick={() => handleViewChange('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" fullLabel="Charges fixes" />
          <NavBtn active={activeView === 'SETTINGS'} onClick={() => handleViewChange('SETTINGS')} icon={<IconSettings />} label="Param." fullLabel="Paramètres" />
        </nav>

        {showAddModal && (
          <AddTransactionModal 
            categories={state.categories} 
            onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} 
            onAdd={handleUpsertTransaction} 
            initialDate={modalInitialDate} 
            editItem={editingTransaction} 
          />
        )}
        
        <AnimatePresence>
          {showWelcome && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
              className="bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4" 
              onClick={() => setShowWelcome(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.9, opacity: 0 }} 
                className="bg-white rounded-[32px] w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[85vh] no-scrollbar relative" 
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-center text-4xl mb-2">🌿</div>
                <h2 className="text-xl font-black text-center italic text-slate-800 tracking-tight mb-4">Bienvenue sur ZenBudget</h2>
                
                <div className="space-y-3">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 flex gap-3">
                      <span className="font-black text-lg text-indigo-600">0.</span>
                      <p className="text-[12px] font-bold text-indigo-900 leading-tight">
                        Pour le démarrage, ajoutez votre solde bancaire actuel comme un <span className="underline decoration-indigo-300">Revenu ponctuel</span> dans le <span className="font-black">Journal</span>.
                      </p>
                    </div>

                    <div className="flex gap-3 px-1 items-start">
                       <span className="font-black text-indigo-600">1.</span>
                       <p className="text-[12px] font-medium text-slate-600 leading-tight">
                         Configurez vos flux fixes dans l'onglet <span className="font-bold text-slate-800">"Fixes"</span>.
                       </p>
                    </div>

                    <div className="flex px-1 items-start">
                       <p className="text-[11px] font-bold text-indigo-500 leading-tight italic">
                         Pensez aussi à ajuster votre <span className="underline">date de cycle budgétaire</span> (ex: jour de paie) tout en bas des <span className="font-black">Paramètres</span>.
                       </p>
                    </div>

                    <div className="flex gap-3 px-1 items-start">
                       <span className="font-black text-indigo-600">2.</span>
                       <p className="text-[12px] font-medium text-slate-600 leading-tight">
                         Saisissez vos dépenses variables dans le <span className="font-bold text-slate-800">Journal</span>, au jour le jour ou selon vos besoins.
                       </p>
                    </div>

                    <div className="flex gap-3 px-1 items-start">
                       <span className="font-black text-indigo-600">3.</span>
                       <p className="text-[12px] font-medium text-slate-600 leading-tight">
                         Vérifiez votre <span className="font-bold text-indigo-700">"Disponible Réel"</span> depuis le <span className="font-bold text-indigo-700">Board</span> pour éviter le découvert.
                       </p>
                    </div>

                    <div className="flex gap-3 px-1 items-start opacity-80">
                       <span className="font-black text-indigo-600">4.</span>
                       <p className="text-[12px] font-medium text-slate-500 leading-tight italic">
                         <span className="font-bold text-slate-800">Export Excel :</span> bientôt disponible pour les membres <span className="text-amber-600 font-bold">Premium</span> !
                       </p>
                    </div>
                </div>

                <button 
                  onClick={() => setShowWelcome(false)} 
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all mt-6"
                >
                  Démarrer l'expérience
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }} 
              animate={{ y: -100, opacity: 1 }} 
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-0 left-0 right-0 flex justify-center z-[9999] pointer-events-none px-6"
            >
              <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
                <span className="text-xl">🙏</span>
                <span className="text-sm font-bold tracking-tight">Merci pour votre retour !</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; fullLabel: string }> = ({ active, onClick, icon, label, fullLabel }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className={`w-5 h-5 transition-transform ${active ? 'scale-110' : 'scale-100'}`}>{icon}</div>
    <span className="text-[9px] font-black uppercase tracking-tighter text-center leading-none">
      <span className="sm:hidden">{label}</span>
      <span className="hidden sm:inline">{fullLabel}</span>
    </span>
  </button>
);

export default App;