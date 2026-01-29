
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, ViewType, Transaction, Category, RecurringTemplate, BudgetAccount } from './types';
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(new Date().toISOString());
  
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getMonth() === currentMonth ? new Date().getDate() : 1);

  const isResetting = useRef(false);

  useEffect(() => {
    if (!isResetting.current) {
      saveState(state);
    }
  }, [state]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    const manualOnes = activeAccount.transactions.filter(t => !t.templateId && !t.isRecurring);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const virtuals: Transaction[] = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive)
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, daysInMonth);
        const isoDate = new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString();
        return {
          id: `virtual-${tpl.id}-${currentMonth}-${currentYear}`,
          amount: tpl.amount,
          type: tpl.type,
          categoryId: tpl.categoryId,
          comment: tpl.comment || (tpl.type === 'INCOME' ? 'Revenu fixe' : 'Charge fixe'),
          date: isoDate,
          isRecurring: true,
          templateId: tpl.id
        };
      });

    return [...manualOnes, ...virtuals].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [activeAccount, currentMonth, currentYear]);

  // Calcul du solde "Stats" : Uniquement le mois en cours jusqu'à aujourd'hui
  const currentMonthBalance = useMemo(() => {
    const now = new Date();
    const isCurrentPeriod = now.getMonth() === currentMonth && now.getFullYear() === currentYear;
    
    return effectiveTransactions.reduce((acc, t) => {
      const tDate = new Date(t.date);
      // Si on regarde le mois actuel, on ne compte que jusqu'à aujourd'hui
      // Si on regarde un mois passé, on compte tout le mois
      const isPastOrToday = !isCurrentPeriod || tDate.getDate() <= now.getDate();
      
      if (isPastOrToday) {
        return acc + (t.type === 'INCOME' ? t.amount : -t.amount);
      }
      return acc;
    }, 0);
  }, [effectiveTransactions, currentMonth, currentYear]);

  const handleMonthChange = (delta: number) => {
    const d = new Date(currentYear, currentMonth + delta, 1);
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
    setSelectedDay(1);
  };

  const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    if (editingTransaction?.id.toString().startsWith('virtual-') || editingTransaction?.templateId) {
      const targetTemplateId = editingTransaction.templateId || editingTransaction.id.toString().split('-')[1];
      setState(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => a.id === activeAccount.id ? {
          ...a,
          recurringTemplates: (a.recurringTemplates || []).map(tpl => 
            tpl.id === targetTemplateId ? { 
              ...tpl, 
              amount: t.amount, 
              categoryId: t.categoryId, 
              comment: t.comment, 
              type: t.type,
              dayOfMonth: new Date(t.date).getDate()
            } : tpl
          )
        } : a)
      }));
    } else if (t.isRecurring && !t.id) {
      const newTpl: RecurringTemplate = {
        id: generateId(),
        amount: t.amount,
        categoryId: t.categoryId,
        comment: t.comment,
        type: t.type,
        dayOfMonth: new Date(t.date).getDate(),
        isActive: true
      };
      setState(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => a.id === activeAccount.id ? { 
          ...a, 
          recurringTemplates: [...(a.recurringTemplates || []), newTpl] 
        } : a)
      }));
    } else {
      setState(prev => {
        const acc = prev.accounts.find(a => a.id === prev.activeAccountId) || prev.accounts[0];
        let nextTransactions = [...acc.transactions];
        const tid = t.id || editingTransaction?.id;
        if (tid) {
          nextTransactions = nextTransactions.map(item => item.id === tid ? ({ ...t, id: tid } as Transaction) : item);
        } else {
          nextTransactions = [{ ...t, id: generateId() } as Transaction, ...nextTransactions];
        }
        return {
          ...prev,
          accounts: prev.accounts.map(a => a.id === acc.id ? { ...a, transactions: nextTransactions } : a)
        };
      });
    }
    setShowAddModal(false);
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: string) => {
    if (id.toString().startsWith('virtual-')) {
      const templateId = id.split('-')[1];
      setState(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => a.id === activeAccount.id ? {
          ...a,
          recurringTemplates: (a.recurringTemplates || []).map(tpl => 
            tpl.id === templateId ? { ...tpl, isActive: false } : tpl
          )
        } : a)
      }));
    } else {
      setState(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => a.id === activeAccount.id ? {
          ...a,
          transactions: a.transactions.filter(t => t.id !== id)
        } : a)
      }));
    }
  };

  // Fix: added missing handleDeleteAccount function
  const handleDeleteAccount = (id: string) => {
    setState(prev => {
      const nextAccounts = prev.accounts.filter(a => a.id !== id);
      const nextActiveId = prev.activeAccountId === id ? (nextAccounts[0]?.id || prev.activeAccountId) : prev.activeAccountId;
      return {
        ...prev,
        accounts: nextAccounts,
        activeAccountId: nextActiveId
      };
    });
  };

  const handleHardReset = () => {
    if (window.confirm("🚨 RÉINITIALISATION TOTALE\n\nEffacer toutes vos données ?")) {
      isResetting.current = true;
      localStorage.clear();
      window.location.href = window.location.pathname;
    }
  };

  const handleFABClick = () => {
    setEditingTransaction(null);
    if (activeView === 'TRANSACTIONS' && selectedDay) {
      const dateStr = new Date(currentYear, currentMonth, selectedDay, 12, 0, 0).toISOString();
      setModalInitialDate(dateStr);
    } else {
      setModalInitialDate(new Date().toISOString());
    }
    setShowAddModal(true);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 safe-top shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo className="w-9 h-9" />
            <h1 className="text-xl font-black tracking-tight text-slate-800 font-logo">ZenBudget</h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200">
             <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-white rounded-full transition-all active:scale-90 text-slate-400 hover:text-indigo-600">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
             </button>
             <span className="text-[10px] font-black uppercase tracking-widest px-2 min-w-[100px] text-center text-slate-600">
               {MONTHS_FR[currentMonth]} {currentYear}
             </span>
             <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-white rounded-full transition-all active:scale-90 text-slate-400 hover:text-indigo-600">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar max-w-2xl w-full mx-auto px-6 py-8 pb-40">
        {activeView === 'DASHBOARD' && (
          <Dashboard 
            transactions={effectiveTransactions} 
            categories={state.categories}
            activeAccount={activeAccount}
            allAccounts={state.accounts}
            onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
            month={currentMonth}
            year={currentYear}
            onViewTransactions={() => setActiveView('TRANSACTIONS')}
          />
        )}
        {activeView === 'TRANSACTIONS' && (
          <TransactionList 
            transactions={effectiveTransactions} 
            categories={state.categories}
            month={currentMonth}
            year={currentYear}
            onDelete={handleDeleteTransaction}
            onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
            onAddAtDate={(date) => { setModalInitialDate(date); setShowAddModal(true); }}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            totalBalance={currentMonthBalance}
          />
        )}
        {activeView === 'RECURRING' && (
          <RecurringManager 
            recurringTemplates={activeAccount?.recurringTemplates || []} 
            categories={state.categories}
            onUpdate={(templates) => setState(prev => ({ 
              ...prev, 
              accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, recurringTemplates: templates } : a) 
            }))}
            totalBalance={currentMonthBalance}
          />
        )}
        {activeView === 'SETTINGS' && (
          <Settings 
            state={state}
            onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))}
            onUpdateBudget={() => {}}
            onUpdateAccounts={(accounts) => setState(prev => ({ ...prev, accounts }))}
            onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
            onDeleteAccount={handleDeleteAccount}
            onReset={handleHardReset}
            onLogout={() => {}}
          />
        )}
      </main>

      {activeView !== 'SETTINGS' && (
        <button 
          onClick={handleFABClick} 
          className="fixed bottom-[100px] right-6 w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white"
        >
          <IconPlus className="w-8 h-8" />
        </button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => { setEditingTransaction(null); setActiveView('RECURRING'); }} icon={<IconPlus className="rotate-45 shadow-none" />} label="Fixes" />
        <NavBtn active={activeView === 'SETTINGS'} onClick={() => setActiveView('SETTINGS')} icon={<IconSettings />} label="Réglages" />
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
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all duration-300 active:scale-95 ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
    <div className={`w-6 h-6 ${active ? 'scale-110 text-indigo-600' : 'scale-100'} transition-transform`}>{icon}</div>
    <span className={`text-[9px] font-black uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
  </button>
);

export default App;
