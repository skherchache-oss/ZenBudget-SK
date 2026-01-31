
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, ViewType, Transaction, Category, BudgetAccount, RecurringTemplate } from './types';
import { getInitialState, saveState, generateId } from './store';
import { MONTHS_FR } from './constants';
import { IconPlus, IconHome, IconCalendar, IconLogo, IconSettings } from './components/Icons';

import Dashboard from './components/Dashboard';
import RecurringManager from './components/RecurringManager';
import TransactionList from './components/TransactionList';
import AddTransactionModal from './components/AddTransactionModal';
import Settings from './components/Settings';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => getInitialState());
  const [activeView, setActiveView] = useState<ViewType>('DASHBOARD');
  
  // Date de référence pour la vue courante (toujours à midi UTC pour éviter les décalages mobiles)
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(new Date().toISOString());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  // Persistance robuste : sauvegarde immédiate sur les changements critiques
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveState(state);
  }, [state]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  // --- UTILS DE DATE HAUTE PRÉCISION (UTC TIMESTAMP) ---
  
  const getUTCMidday = (year: number, month: number, day: number) => {
    return Date.UTC(year, month, day, 12, 0, 0);
  };

  const getMonthKeyFromTS = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
  };

  // --- MOTEUR DE PROJECTION INDESTRUCTIBLE ---
  
  const getProjectedBalanceAtDate = (targetDate: Date) => {
    if (!activeAccount) return 0;
    
    const targetTS = targetDate.getTime();
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
    const templates = activeAccount.recurringTemplates || [];

    // 1. Calcul du socle : Transactions Réelles (saisies)
    let balance = activeAccount.transactions.reduce((acc, t) => {
      return new Date(t.date).getTime() <= targetTS ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    // 2. Injection des charges virtuelles manquantes
    // On remonte au début de l'année précédente ou à la 1ère transaction pour être sûr
    let startYear = currentYear - 1;
    let startMonth = 0;
    if (activeAccount.transactions.length > 0) {
      const firstTxDate = new Date(Math.min(...activeAccount.transactions.map(t => new Date(t.date).getTime())));
      startYear = firstTxDate.getUTCFullYear();
      startMonth = firstTxDate.getUTCMonth();
    }

    let cursorYear = startYear;
    let cursorMonth = startMonth;
    let safety = 0;
    const targetMonthTS = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), 1);

    while (safety < 60) { // Max 5 ans de projection
      const currentMonthTS = Date.UTC(cursorYear, cursorMonth, 1);
      const currentMonthKey = `${cursorYear}-${cursorMonth}`;

      // Quelles charges fixes sont déjà pointées (matérialisées) ce mois-ci ?
      const materializedIds = new Set(
        activeAccount.transactions
          .filter(t => {
            const d = new Date(t.date);
            return d.getUTCFullYear() === cursorYear && d.getUTCMonth() === cursorMonth && t.templateId;
          })
          .map(t => String(t.templateId))
      );

      templates.forEach(tpl => {
        if (!tpl.isActive || materializedIds.has(String(tpl.id))) return;

        const lastDay = new Date(cursorYear, cursorMonth + 1, 0).getDate();
        const day = Math.min(tpl.dayOfMonth, lastDay);
        const tplTS = getUTCMidday(cursorYear, cursorMonth, day);
        const vId = `virtual-${tpl.id}-${cursorMonth}-${cursorYear}`;

        // On inclut si la date théorique <= target ET que l'utilisateur n'a pas supprimé ce virtuel spécifique
        if (tplTS <= targetTS && !deletedVirtuals.has(vId)) {
          balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
        }
      });

      if (currentMonthTS >= targetMonthTS) break;
      cursorMonth++;
      if (cursorMonth > 11) { cursorMonth = 0; cursorYear++; }
      safety++;
    }

    return balance;
  };

  // --- CALCULS DE SOLDE POUR LA VUE ---

  const checkingAccountBalance = useMemo(() => {
    if (!activeAccount) return 0;
    const nowTS = Date.now();
    return activeAccount.transactions.reduce((acc, t) => {
      return new Date(t.date).getTime() <= nowTS ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);
  }, [activeAccount]);

  const availableBalance = useMemo(() => {
    // Solde à la fin du mois réel courant
    const d = new Date();
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    return getProjectedBalanceAtDate(endOfMonth);
  }, [activeAccount]);

  const projectedBalance = useMemo(() => {
    // Solde à la fin du mois affiché dans le journal
    const endOfViewMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return getProjectedBalanceAtDate(endOfViewMonth);
  }, [activeAccount, currentMonth, currentYear]);

  const carryOver = useMemo(() => {
    // Solde à la veille du mois affiché
    const lastDayPrev = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    return getProjectedBalanceAtDate(lastDayPrev);
  }, [activeAccount, currentMonth, currentYear]);

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    
    // 1. Réelles
    const realOnes = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth;
    });

    const materializedIds = new Set(realOnes.map(t => String(t.templateId || "")));
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);

    // 2. Virtuelles du mois en cours
    const virtuals: Transaction[] = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !materializedIds.has(String(tpl.id)))
      .map(tpl => {
        const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        const day = Math.min(tpl.dayOfMonth, lastDay);
        const vId = `virtual-${tpl.id}-${currentMonth}-${currentYear}`;
        
        return {
          id: vId,
          amount: tpl.amount, 
          type: tpl.type, 
          categoryId: tpl.categoryId,
          comment: tpl.comment || (tpl.type === 'INCOME' ? 'Revenu fixe' : 'Charge fixe'),
          date: new Date(getUTCMidday(currentYear, currentMonth, day)).toISOString(),
          isRecurring: true, 
          templateId: tpl.id
        };
      })
      .filter(v => !deletedVirtuals.has(v.id));

    return [...realOnes, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear]);

  // --- HANDLERS ---

  const handleMonthChange = (offset: number) => {
    setSlideDirection(offset > 0 ? 'next' : 'prev');
    let nm = currentMonth + offset;
    let ny = currentYear;
    if (nm < 0) { nm = 11; ny -= 1; }
    else if (nm > 11) { nm = 0; ny += 1; }
    setCurrentMonth(nm);
    setCurrentYear(ny);
    setSelectedDay(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    setState(prev => {
      const accIdx = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
      if (accIdx === -1) return prev;
      
      const acc = { ...prev.accounts[accIdx] };
      let nextTx = [...acc.transactions];
      let nextTpls = [...(acc.recurringTemplates || [])];
      let nextDels = [...(acc.deletedVirtualIds || [])];
      
      const targetId = String(t.id || editingTransaction?.id || "");
      const isVirtual = targetId.startsWith('virtual-');
      const templateId = t.templateId || (isVirtual ? targetId.split('-')[1] : undefined);

      // Si c'est un fixe, on met à jour le template global
      if (t.isRecurring && templateId) {
        nextTpls = nextTpls.map(tpl => String(tpl.id) === String(templateId) ? { ...tpl, amount: t.amount, categoryId: t.categoryId, comment: t.comment, type: t.type } : tpl);
      }

      if (targetId && !isVirtual && nextTx.some(i => String(i.id) === targetId)) {
        // Update d'une transaction réelle existante
        nextTx = nextTx.map(i => String(i.id) === targetId ? ({ ...t, id: targetId, templateId } as Transaction) : i);
      } else {
        // Création ou Matérialisation d'un virtuel
        if (isVirtual) nextDels.push(targetId);
        nextTx = [{ ...t, id: generateId(), templateId } as Transaction, ...nextTx];
      }

      const nextAccounts = [...prev.accounts];
      nextAccounts[accIdx] = { ...acc, transactions: nextTx, recurringTemplates: nextTpls, deletedVirtualIds: nextDels };
      return { ...prev, accounts: nextAccounts };
    });
    setShowAddModal(false);
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: string) => {
    const idStr = String(id);
    setState(prev => {
      const accIdx = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
      if (accIdx === -1) return prev;
      
      const acc = { ...prev.accounts[accIdx] };
      let nextDels = [...(acc.deletedVirtualIds || [])];
      
      // Si on supprime un virtuel, on l'ajoute à la liste noire persistante
      if (idStr.startsWith('virtual-')) {
        nextDels.push(idStr);
      }
      
      const nextAccounts = [...prev.accounts];
      nextAccounts[accIdx] = { 
        ...acc, 
        transactions: acc.transactions.filter(t => String(t.id) !== idStr),
        deletedVirtualIds: nextDels 
      };
      return { ...prev, accounts: nextAccounts };
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 safe-top shrink-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <IconLogo className="w-8 h-8" />
            <h1 className="text-xl font-black tracking-tighter text-slate-900">ZenBudget</h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm flex-1 max-w-[180px] justify-between">
             <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 active:scale-90"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg></button>
             <div className="flex items-center justify-center gap-1.5 px-1 overflow-hidden">
                <span className="text-[12px] font-black uppercase tracking-widest text-indigo-700 whitespace-nowrap">{MONTHS_FR[currentMonth]} {currentYear}</span>
             </div>
             <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 active:scale-90"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto px-4 py-2 pb-24">
        {activeView === 'DASHBOARD' && (
          <Dashboard 
            transactions={effectiveTransactions} categories={state.categories} activeAccount={activeAccount} allAccounts={state.accounts}
            onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} month={currentMonth} year={currentYear}
            onViewTransactions={() => setActiveView('TRANSACTIONS')} checkingAccountBalance={checkingAccountBalance} availableBalance={availableBalance} projectedBalance={projectedBalance}
            carryOver={carryOver}
          />
        )}
        {activeView === 'TRANSACTIONS' && (
          <TransactionList 
            transactions={effectiveTransactions} categories={state.categories} month={currentMonth} year={currentYear}
            onDelete={handleDeleteTransaction} onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
            onAddAtDate={(date) => { setModalInitialDate(date); setShowAddModal(true); }}
            selectedDay={selectedDay} onSelectDay={setSelectedDay} totalBalance={projectedBalance}
            carryOver={carryOver} cycleEndDay={activeAccount?.cycleEndDay || 0}
            onMonthChange={handleMonthChange} slideDirection={slideDirection}
          />
        )}
        {activeView === 'RECURRING' && (
          <RecurringManager 
            recurringTemplates={activeAccount?.recurringTemplates || []} categories={state.categories}
            onUpdate={(templates) => setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, recurringTemplates: templates } : a) }))}
            totalBalance={projectedBalance}
          />
        )}
        {activeView === 'SETTINGS' && (
          <Settings 
            state={state} onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))} onUpdateBudget={() => {}}
            onUpdateAccounts={(accounts) => setState(prev => ({ ...prev, accounts }))} onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
            onDeleteAccount={(id) => {
              setState(prev => {
                const nextAccounts = prev.accounts.filter(a => a.id !== id);
                if (nextAccounts.length === 0) return prev;
                let nextActiveId = prev.activeAccountId;
                if (id === prev.activeAccountId) { nextActiveId = nextAccounts[0].id; }
                return { ...prev, accounts: nextAccounts, activeAccountId: nextActiveId };
              });
            }}
            onReset={() => { if (window.confirm("Tout effacer ?")) { localStorage.clear(); window.location.reload(); } }} onLogout={() => {}}
          />
        )}
      </main>

      <button onClick={() => { 
        setEditingTransaction(null); 
        const d = new Date(currentYear, currentMonth, selectedDay || 1, 12, 0, 0);
        setModalInitialDate(d.toISOString()); 
        setShowAddModal(true); 
      }} 
        className="fixed bottom-[100px] right-6 w-14 h-14 bg-slate-900 text-white rounded-[22px] shadow-2xl flex items-center justify-center active:scale-90 z-40 border-4 border-white transition-all"><IconPlus className="w-7 h-7" /></button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] px-6 z-40">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => setActiveView('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
        <NavBtn active={activeView === 'SETTINGS'} onClick={() => setActiveView('SETTINGS')} icon={<IconSettings />} label="Réglages" />
      </nav>

      {showAddModal && <AddTransactionModal categories={state.categories} onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} onAdd={handleUpsertTransaction} initialDate={modalInitialDate} editItem={editingTransaction} />}
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className={`w-5 h-5 ${active ? 'scale-110' : 'scale-100'}`}>{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;
