import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  const isInitialMount = useRef(true);
  
  // --- LOGIQUE RATING & USAGE ---
  useEffect(() => {
    const firstLaunch = localStorage.getItem('zenbudget_first_launch');
    const hasRated = localStorage.getItem('zenbudget_has_rated');
    
    if (!firstLaunch) {
      localStorage.setItem('zenbudget_first_launch', Date.now().toString());
    } else if (!hasRated) {
      const diffDays = (Date.now() - parseInt(firstLaunch)) / (1000 * 3600 * 24);
      if (diffDays > 3) {
        const timer = setTimeout(() => setShowRatingModal(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // --- SAUVEGARDE AUTO ---
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

  // --- MOTEUR DE CALCULS & PROJECTION (RÉINTÉGRÉ) ---
  const getProjectedBalanceAtDate = useCallback((targetDate: Date) => {
    if (!activeAccount) return 0;
    let balance = activeAccount.transactions.reduce((acc, t) => {
      return new Date(t.date) <= targetDate ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    const templates = activeAccount.recurringTemplates || [];
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    if (targetDate < cursor) cursor = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);

    while (cursor <= targetDate) {
      const cM = cursor.getMonth();
      const cY = cursor.getFullYear();
      const materializedIds = new Set(activeAccount.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === cM && d.getFullYear() === cY;
      }).map(t => t.templateId).filter(Boolean));

      templates.forEach(tpl => {
        if (!tpl.isActive || materializedIds.has(tpl.id)) return;
        const day = Math.min(tpl.dayOfMonth, new Date(cY, cM + 1, 0).getDate());
        const tplDate = new Date(cY, cM, day, 12, 0, 0);
        const vId = `virtual-${tpl.id}-${cM}-${cY}`;
        if (tplDate <= targetDate && !deletedVirtuals.has(vId)) {
          balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
        }
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return balance;
  }, [activeAccount]);

  const checkingAccountBalance = useMemo(() => {
    return activeAccount.transactions.reduce((acc, t) => {
      return new Date(t.date) <= new Date() ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);
  }, [activeAccount]);

  const availableBalance = useMemo(() => {
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
    return getProjectedBalanceAtDate(endOfMonth);
  }, [getProjectedBalanceAtDate]);

  const projectedBalance = useMemo(() => {
    const endOfView = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return getProjectedBalanceAtDate(endOfView);
  }, [currentMonth, currentYear, getProjectedBalanceAtDate]);

  const effectiveTransactions = useMemo(() => {
    const manuals = (activeAccount.transactions || []).filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const materializedIds = new Set(manuals.map(t => t.templateId).filter(Boolean));
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);

    const virtuals = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !materializedIds.has(tpl.id))
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        return {
          id: `virtual-${tpl.id}-${currentMonth}-${currentYear}`,
          amount: tpl.amount, type: tpl.type, categoryId: tpl.categoryId,
          comment: tpl.comment || 'Charge fixe',
          date: new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString(),
          isRecurring: true, templateId: tpl.id
        } as Transaction;
      }).filter(v => !deletedVirtuals.has(v.id));

    return [...manuals, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear]);

  // --- HANDLERS ---
  const handleMonthChange = (offset: number) => {
    let nm = currentMonth + offset;
    let ny = currentYear;
    if (nm < 0) { nm = 11; ny -= 1; }
    else if (nm > 11) { nm = 0; ny += 1; }
    setCurrentMonth(nm);
    setCurrentYear(ny);
  };

  const handleUpsertTransaction = (newTData: Omit<Transaction, 'id'> & { id?: string }) => {
    const targetId = newTData.id || generateId();
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc => {
        if (acc.id === prev.activeAccountId) {
          let nextTx = [...acc.transactions];
          if (targetId.toString().startsWith('virtual-')) {
            nextTx = [{ ...newTData, id: generateId() } as Transaction, ...nextTx];
            return { ...acc, transactions: nextTx, deletedVirtualIds: [...(acc.deletedVirtualIds || []), targetId.toString()] };
          }
          if (newTData.id) nextTx = nextTx.map(tx => tx.id === newTData.id ? { ...newTData, id: targetId } as Transaction : tx);
          else nextTx = [{ ...newTData, id: targetId } as Transaction, ...nextTx];
          return { ...acc, transactions: nextTx };
        }
        return acc;
      })
    }));
    setShowAddModal(false);
    setEditingTransaction(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 shrink-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3"><IconLogo className="w-8 h-8" /><h1 className="text-xl font-black tracking-tighter text-slate-900 italic">ZenBudget</h1></div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm flex-1 max-w-[180px] justify-between">
             <button onClick={() => handleMonthChange(-1)} className="p-2 text-slate-400">‹</button>
             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">{MONTHS_FR[currentMonth]} {currentYear}</span>
             <button onClick={() => handleMonthChange(1)} className="p-2 text-slate-400">›</button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto px-4 pt-2">
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
            checkingAccountBalance={checkingAccountBalance} 
            availableBalance={availableBalance} 
            projectedBalance={projectedBalance} 
            carryOver={0} 
          />
        )}
        {activeView === 'TRANSACTIONS' && (
          <TransactionList 
            transactions={effectiveTransactions} 
            categories={state.categories} 
            month={currentMonth} 
            year={currentYear} 
            onAddAtDate={(d) => { setSelectedDay(parseInt(d.split('-')[2])); setShowAddModal(true); }}
            onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
            onDelete={(id) => setState(prev => ({...prev, accounts: prev.accounts.map(a => a.id === prev.activeAccountId ? {...a, transactions: a.transactions.filter(tx => tx.id !== id)} : a)}))}
          />
        )}
        {activeView === 'RECURRING' && (
          <RecurringManager 
            recurringTemplates={activeAccount.recurringTemplates || []} 
            categories={state.categories} 
            onUpdate={(t) => setState(prev => ({...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? {...a, recurringTemplates: t} : a)}))}
          />
        )}
        {activeView === 'SETTINGS' && (
          <Settings 
            state={state} 
            onUpdateAccounts={(accs) => setState(prev => ({...prev, accounts: accs}))}
            onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
            onDeleteAccount={(id) => setState(prev => ({...prev, accounts: prev.accounts.filter(a => a.id !== id)}))}
            onReset={() => { localStorage.clear(); window.location.reload(); }}
            onUpdateCategories={() => {}}
            onUpdateBudget={() => {}}
            onLogout={() => {}}
          />
        )}
      </main>

      <button onClick={() => { setEditingTransaction(null); setShowAddModal(true); }} className="fixed bottom-[100px] right-6 w-14 h-14 bg-slate-900 text-white rounded-[22px] shadow-2xl flex items-center justify-center active:scale-90 z-40 border-4 border-white">
        <IconPlus className="w-7 h-7" />
      </button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-2 pb-8 px-6 z-50">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => setActiveView('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
        <NavBtn active={activeView === 'SETTINGS'} onClick={() => setActiveView('SETTINGS')} icon={<IconSettings />} label="Réglages" />
      </nav>

      {showAddModal && (
        <AddTransactionModal 
          isOpen={showAddModal}
          categories={state.categories} 
          onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} 
          onSave={handleUpsertTransaction} 
          initialDate={new Date(currentYear, currentMonth, selectedDay || 1)}
          editItem={editingTransaction}
        />
      )}
      
      {showRatingModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-t-[40px] shadow-2xl p-8 relative animate-in slide-in-from-bottom duration-500 pb-12">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center text-3xl animate-bounce">✨</div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Vivez-vous l'expérience Zen ?</h3>
              <p className="text-[12px] font-medium text-slate-500 leading-relaxed px-4">Si vous aimez ZenBudget, votre avis nous aiderait énormément à faire grandir l'application !</p>
              <div className="flex flex-col w-full gap-3 pt-4">
                <button 
                  onClick={() => { localStorage.setItem('zenbudget_has_rated', 'true'); setShowRatingModal(false); }}
                  className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all text-[11px] uppercase tracking-widest"
                >
                  Noter l'application
                </button>
                <button 
                  onClick={() => { setShowRatingModal(false); }}
                  className="w-full py-4 bg-white border border-slate-100 text-slate-400 font-black rounded-2xl active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className="w-5 h-5">{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;