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

  const handleMonthChange = (delta: number) => {
    const d = new Date(currentYear, currentMonth + delta, 1);
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
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
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(a => a.id === activeAccount.id ? {
        ...a,
        recurringTemplates: id.toString().startsWith('virtual-') 
          ? (a.recurringTemplates || []).map(tpl => tpl.id === id.split('-')[1] ? { ...tpl, isActive: false } : tpl)
          : a.recurringTemplates,
        transactions: !id.toString().startsWith('virtual-')
          ? a.transactions.filter(t => t.id !== id)
          : a.transactions
      } : a)
    }));
  };

  const handleHardReset = () => {
    if (window.confirm("🚨 RÉINITIALISATION TOTALE\n\nSouhaitez-vous vraiment effacer TOUTES vos données ?")) {
      isResetting.current = true;
      localStorage.removeItem('zenbudget_state_v3');
      window.location.reload();
    }
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
             <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-white rounded-full transition-all active:scale-90 text-slate-400">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
             </button>
             <span className="text-[10px] font-black uppercase tracking-widest px-2 min-w-[80px] text-center text-slate-600">
               {MONTHS_FR[currentMonth]} {currentYear}
             </span>
             <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-white rounded-full transition-all active:scale-90 text-slate-400">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar max-w-2xl w-full mx-auto px-4 py-6 pb-32">
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
          />
        )}
        {activeView === 'SETTINGS' && (
          <Settings 
            state={state}
            onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))}
            onUpdateBudget={() => {}}
            onUpdateAccounts={(accounts) => setState(prev => ({ ...prev, accounts }))}
            onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
            onDeleteAccount={(id) => {
              if (state.accounts.length > 1) {
                setState(prev => {
                  const filtered = prev.accounts.filter(a => a.id !== id);
                  return { ...prev, accounts: filtered, activeAccountId: filtered[0].id };
                });
              }
            }}
            onReset={handleHardReset}
            onLogout={() => {}}
          />
        )}
      </main>

      {activeView !== 'SETTINGS' && (
        <button 
          onClick={() => { setEditingTransaction(null); setModalInitialDate(new Date().toISOString()); setShowAddModal(true); }} 
          className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all z-40 border-2 border-white"
        >
          <IconPlus className="w-7 h-7" />
        </button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-3 pb-[env(safe-area-inset-bottom,1.5rem)] px-6 z-40 shadow-lg">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => { setEditingTransaction(null); setActiveView('RECURRING'); }} icon={<IconPlus className="rotate-45" />} label="Fixes" />
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
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className={`w-6 h-6 ${active ? 'scale-110' : 'scale-100'} transition-transform`}>{icon}</div>
    <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
  </button>
);

export default App;