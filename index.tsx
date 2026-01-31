
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, ViewType, Transaction, Category, BudgetAccount } from './types';
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
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(new Date().toISOString());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveState(state);
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  // Calcul du solde incluant les projections de manière robuste pour tous les mois
  const getBalanceAtDate = (targetDate: Date, includeProjections: boolean) => {
    if (!activeAccount) return 0;
    
    // 1. Transactions réelles pointées
    let balance = activeAccount.transactions.reduce((acc, t) => {
      const tDate = new Date(t.date);
      return tDate <= targetDate ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    // 2. Ajout des charges fixes non encore matérialisées
    if (includeProjections) {
      const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
      const templates = activeAccount.recurringTemplates || [];
      
      // On scanne les mois de "now" jusqu'à la date cible
      // Si la date cible est dans le passé par rapport au début du mois courant, on commence au mois de targetDate
      let startYear = Math.min(now.getFullYear(), targetDate.getFullYear());
      let startMonth = startYear === now.getFullYear() ? now.getMonth() : targetDate.getMonth();
      
      let cursor = new Date(startYear, startMonth, 1);
      const limit = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);

      while (cursor < limit) {
        const cMonth = cursor.getMonth();
        const cYear = cursor.getFullYear();
        
        const materializedIds = new Set(
          activeAccount.transactions
            .filter(t => {
              const d = new Date(t.date);
              return d.getMonth() === cMonth && d.getFullYear() === cYear;
            })
            .map(t => t.templateId).filter(Boolean)
        );

        templates.forEach(tpl => {
          if (!tpl.isActive || materializedIds.has(tpl.id)) return;
          
          const day = Math.min(tpl.dayOfMonth, new Date(cYear, cMonth + 1, 0).getDate());
          const tplDate = new Date(cYear, cMonth, day, 12, 0, 0);
          const vId = `virtual-${tpl.id}-${cMonth}-${cYear}`;
          
          // Si la date théorique est avant ou égale à targetDate et non supprimée
          if (tplDate <= targetDate && !deletedVirtuals.has(vId)) {
            balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
          }
        });
        cursor.setMonth(cursor.getMonth() + 1);
        if (cursor.getFullYear() > now.getFullYear() + 2) break;
      }
    }
    return balance;
  };

  const checkingAccountBalance = useMemo(() => getBalanceAtDate(now, false), [activeAccount, now]);
  
  const availableBalance = useMemo(() => {
    const cycleDay = activeAccount?.cycleEndDay || 0;
    let target = new Date(now.getFullYear(), now.getMonth(), cycleDay || 28, 23, 59, 59);
    if (now > target) target.setMonth(target.getMonth() + 1);
    return getBalanceAtDate(target, true);
  }, [activeAccount, now]);

  const projectedBalance = useMemo(() => {
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return getBalanceAtDate(lastDayOfMonth, true);
  }, [activeAccount, currentMonth, currentYear, now]);

  const carryOver = useMemo(() => {
    const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    return getBalanceAtDate(lastDayOfPrevMonth, true);
  }, [activeAccount, currentMonth, currentYear, now]);

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    
    // Transactions saisies pour le mois sélectionné
    const manuals = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const materializedIds = new Set(manuals.map(t => t.templateId).filter(Boolean));
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);

    // Projections virtuelles pour le mois sélectionné (fixes non encore payés)
    const virtuals: Transaction[] = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !materializedIds.has(tpl.id))
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        return {
          id: `virtual-${tpl.id}-${currentMonth}-${currentYear}`,
          amount: tpl.amount, 
          type: tpl.type, 
          categoryId: tpl.categoryId,
          comment: tpl.comment || (tpl.type === 'INCOME' ? 'Revenu fixe' : 'Charge fixe'),
          date: new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString(),
          isRecurring: true, 
          templateId: tpl.id
        };
      })
      .filter(v => !deletedVirtuals.has(v.id));

    return [...manuals, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear, now]);

  const handleMonthChange = (offset: number) => {
    setSlideDirection(offset > 0 ? 'next' : 'prev');
    let nextMonth = currentMonth + offset;
    let nextYear = currentYear;
    if (nextMonth < 0) { nextMonth = 11; nextYear -= 1; }
    else if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
    setCurrentMonth(nextMonth);
    setCurrentYear(nextYear);
    setSelectedDay(1);
  };

  const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    setState(prev => {
      const accIndex = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
      if (accIndex === -1) return prev;
      const acc = { ...prev.accounts[accIndex] };
      let nextTransactions = [...acc.transactions];
      let nextTemplates = [...(acc.recurringTemplates || [])];
      let nextDeletedVirtuals = [...(acc.deletedVirtualIds || [])];
      const targetId = t.id || editingTransaction?.id;
      const isVirtual = targetId?.toString().startsWith('virtual-');
      const templateId = t.templateId || (isVirtual ? targetId?.toString().split('-')[1] : undefined);
      
      if (t.isRecurring && templateId) {
        nextTemplates = nextTemplates.map(tpl => tpl.id === templateId ? { ...tpl, amount: t.amount, categoryId: t.categoryId, comment: t.comment, type: t.type } : tpl);
      }
      
      if (targetId && !isVirtual && nextTransactions.some(i => i.id === targetId)) {
        nextTransactions = nextTransactions.map(i => i.id === targetId ? ({ ...t, id: targetId, templateId } as Transaction) : i);
      } else {
        if (isVirtual && targetId) nextDeletedVirtuals.push(targetId);
        nextTransactions = [{ ...t, id: generateId(), templateId } as Transaction, ...nextTransactions];
      }
      const nextAccounts = [...prev.accounts];
      nextAccounts[accIndex] = { ...acc, transactions: nextTransactions, recurringTemplates: nextTemplates, deletedVirtualIds: nextDeletedVirtuals };
      return { ...prev, accounts: nextAccounts };
    });
    setShowAddModal(false);
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: string) => {
    setState(prev => {
      const accIndex = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
      if (accIndex === -1) return prev;
      const acc = { ...prev.accounts[accIndex] };
      let nextDeletedVirtuals = [...(acc.deletedVirtualIds || [])];
      if (id.startsWith('virtual-')) nextDeletedVirtuals.push(id);
      const nextAccounts = [...prev.accounts];
      nextAccounts[accIndex] = { ...acc, transactions: acc.transactions.filter(t => t.id !== id), deletedVirtualIds: nextDeletedVirtuals };
      return { ...prev, accounts: nextAccounts };
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 safe-top shrink-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <IconLogo className="w-8 h-8 text-indigo-600" />
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
                if (id === prev.activeAccountId) {
                  nextActiveId = nextAccounts[0].id;
                }
                return { ...prev, accounts: nextAccounts, activeAccountId: nextActiveId };
              });
            }}
            onReset={() => { if (window.confirm("Tout effacer définitivement ?")) { localStorage.clear(); window.location.reload(); } }} onLogout={() => {}}
          />
        )}
      </main>

      <button onClick={() => { setEditingTransaction(null); setModalInitialDate(new Date(currentYear, currentMonth, selectedDay || 1, 12, 0, 0).toISOString()); setShowAddModal(true); }} 
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
  
  setTimeout(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 300);
    }
  }, 100);
}

export default App;
