
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

  // Fonction pivot : Calcule le solde total projeté pour n'importe quel mois/année donné
  const calculateMonthPerformance = (month: number, year: number, account: BudgetAccount) => {
    // 1. Transactions réelles du mois
    const realSum = account.transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : -t.amount), 0);

    // 2. Charges fixes projetées (seulement si elles n'ont pas de transaction réelle correspondante ce mois-là)
    const materializedTplIds = new Set(
      account.transactions
        .filter(t => t.templateId && new Date(t.date).getMonth() === month && new Date(t.date).getFullYear() === year)
        .map(t => t.templateId)
    );

    const recurringSum = (account.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !materializedTplIds.has(tpl.id))
      .reduce((acc, tpl) => acc + (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount), 0);

    return realSum + recurringSum;
  };

  // CALCUL DU REPORT (CARRY-OVER) : Itération depuis le début des temps jusqu'au mois M-1
  const carryOverBalance = useMemo(() => {
    if (!activeAccount) return 0;

    // On cherche le mois de la toute première transaction pour commencer le calcul
    let startYear = currentYear;
    let startMonth = currentMonth;
    if (activeAccount.transactions.length > 0) {
      const dates = activeAccount.transactions.map(t => new Date(t.date).getTime());
      const firstDate = new Date(Math.min(...dates));
      startYear = firstDate.getFullYear();
      startMonth = firstDate.getMonth();
    } else {
      // Si pas de transactions, on remonte arbitrairement d'un an
      const oneYearAgo = new Date(currentYear, currentMonth - 12, 1);
      startYear = oneYearAgo.getFullYear();
      startMonth = oneYearAgo.getMonth();
    }

    let runningBalance = 0;
    let iterMonth = startMonth;
    let iterYear = startYear;

    // On boucle jusqu'au mois précédant le mois actuel
    while (iterYear < currentYear || (iterYear === currentYear && iterMonth < currentMonth)) {
      runningBalance += calculateMonthPerformance(iterMonth, iterYear, activeAccount);
      
      iterMonth++;
      if (iterMonth > 11) {
        iterMonth = 0;
        iterYear++;
      }
    }

    return runningBalance;
  }, [activeAccount, currentMonth, currentYear]);

  // Transactions effectives pour le mois sélectionné
  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    
    const manualOnes = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const materializedTplIds = new Set(manualOnes.map(t => t.templateId).filter(Boolean));

    const virtuals: Transaction[] = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !materializedTplIds.has(tpl.id))
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

  // Solde final projeté du mois affiché
  const projectedBalance = useMemo(() => {
    const monthPerf = effectiveTransactions.reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : -t.amount), 0);
    return carryOverBalance + monthPerf;
  }, [effectiveTransactions, carryOverBalance]);

  const handleMonthChange = (delta: number) => {
    const d = new Date(currentYear, currentMonth + delta, 1);
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
    setSelectedDay(1);
  };

  const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    setState(prev => {
      const acc = prev.accounts.find(a => a.id === prev.activeAccountId) || prev.accounts[0];
      let nextTransactions = [...acc.transactions];
      const tid = t.id || editingTransaction?.id;
      const cleanId = tid?.toString().startsWith('virtual-') ? generateId() : tid;

      if (cleanId && acc.transactions.some(item => item.id === cleanId)) {
        nextTransactions = nextTransactions.map(item => item.id === cleanId ? ({ ...t, id: cleanId } as Transaction) : item);
      } else {
        nextTransactions = [{ ...t, id: cleanId || generateId() } as Transaction, ...nextTransactions];
      }

      return {
        ...prev,
        accounts: prev.accounts.map(a => a.id === acc.id ? { ...a, transactions: nextTransactions } : a)
      };
    });
    setShowAddModal(false);
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: string) => {
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(a => a.id === activeAccount.id ? {
        ...a,
        transactions: a.transactions.filter(t => t.id !== id)
      } : a)
    }));
  };

  const handleDeleteAccount = (id: string) => {
    setState(prev => {
      const remaining = prev.accounts.filter(acc => acc.id !== id);
      return {
        ...prev,
        accounts: remaining,
        activeAccountId: prev.activeAccountId === id ? (remaining[0]?.id || '') : prev.activeAccountId
      };
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-3 safe-top shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo className="w-8 h-8" />
            <h1 className="text-lg font-black tracking-tight text-slate-800 font-logo">ZenBudget</h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200 scale-90 origin-right transition-all">
             <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-white rounded-full transition-all active:scale-90 text-slate-400 hover:text-indigo-600">
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
             </button>
             <span className="text-[9px] font-black uppercase tracking-widest px-2 min-w-[90px] text-center text-slate-600">
               {MONTHS_FR[currentMonth]} {currentYear}
             </span>
             <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-white rounded-full transition-all active:scale-90 text-slate-400 hover:text-indigo-600">
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto px-5 py-3 pb-24">
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
            carryOver={carryOverBalance}
          />
        )}
        {activeView === 'TRANSACTIONS' && (
          <div className="h-full overflow-y-auto no-scrollbar">
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
              totalBalance={projectedBalance}
              carryOver={carryOverBalance}
            />
          </div>
        )}
        {activeView === 'RECURRING' && (
          <div className="h-full overflow-y-auto no-scrollbar">
            <RecurringManager 
              recurringTemplates={activeAccount?.recurringTemplates || []} 
              categories={state.categories}
              onUpdate={(templates) => setState(prev => ({ 
                ...prev, 
                accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, recurringTemplates: templates } : a) 
              }))}
              totalBalance={projectedBalance}
            />
          </div>
        )}
        {activeView === 'SETTINGS' && (
          <div className="h-full overflow-y-auto no-scrollbar">
            <Settings 
              state={state}
              onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))}
              onUpdateBudget={() => {}}
              onUpdateAccounts={(accounts) => setState(prev => ({ ...prev, accounts }))}
              onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
              onDeleteAccount={handleDeleteAccount}
              onReset={() => {
                if (window.confirm("Tout effacer ?")) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              onLogout={() => {}}
            />
          </div>
        )}
      </main>

      <button 
        onClick={() => {
          setEditingTransaction(null);
          const dateStr = selectedDay 
            ? new Date(currentYear, currentMonth, selectedDay, 12, 0, 0).toISOString()
            : new Date().toISOString();
          setModalInitialDate(dateStr);
          setShowAddModal(true);
        }} 
        className="fixed bottom-[100px] right-6 w-14 h-14 bg-slate-900 text-white rounded-[22px] shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white"
      >
        <IconPlus className="w-7 h-7" />
      </button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] px-6 z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.02)]">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => setActiveView('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
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
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
    <div className={`w-5 h-5 ${active ? 'scale-110' : 'scale-100'} transition-transform`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
  </button>
);

export default App;
