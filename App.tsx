import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppState, ViewType, Transaction, BudgetAccount } from './types';
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

  useEffect(() => {
    const timer = setTimeout(() => saveState(state), 1000);
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

  // --- CALCULS ---
  const getBalanceAtDate = useCallback((targetDate: Date, includeProjections: boolean) => {
    if (!activeAccount) return 0;
    let balance = activeAccount.transactions.reduce((acc, t) => {
      return new Date(t.date) <= targetDate ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    if (includeProjections && targetDate > now) {
      const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
      let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
      let safety = 0;
      while (cursor <= targetDate && safety < 24) {
        const cM = cursor.getMonth();
        const cY = cursor.getFullYear();
        const materializedIds = new Set(activeAccount.transactions
          .filter(t => { const d = new Date(t.date); return d.getMonth() === cM && d.getFullYear() === cY; })
          .map(t => t.templateId).filter(Boolean));

        (activeAccount.recurringTemplates || []).forEach(tpl => {
          if (!tpl.isActive || materializedIds.has(tpl.id)) return;
          const day = Math.min(tpl.dayOfMonth, new Date(cY, cM + 1, 0).getDate());
          const tplDate = new Date(cY, cM, day, 12, 0, 0);
          if (tplDate > now && tplDate <= targetDate && !deletedVirtuals.has(`virtual-${tpl.id}-${cM}-${cY}`)) {
            balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
          }
        });
        cursor.setMonth(cursor.getMonth() + 1);
        safety++;
      }
    }
    return balance;
  }, [activeAccount, now]);

  const checkingAccountBalance = useMemo(() => getBalanceAtDate(now, false), [activeAccount?.transactions, now, getBalanceAtDate]);

  const availableBalance = useMemo(() => {
    const cycleDay = activeAccount?.cycleEndDay || 28;
    let target = new Date(now.getFullYear(), now.getMonth(), cycleDay, 23, 59, 59);
    if (now > target) target.setMonth(target.getMonth() + 1);
    return getBalanceAtDate(target, true);
  }, [activeAccount?.transactions, activeAccount?.recurringTemplates, activeAccount?.cycleEndDay, now, getBalanceAtDate]);

  const projectedBalance = useMemo(() => {
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return getBalanceAtDate(lastDayOfMonth, true);
  }, [activeAccount?.transactions, activeAccount?.recurringTemplates, currentMonth, currentYear, getBalanceAtDate]);

  const carryOver = useMemo(() => {
    const lastDayPrev = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    return getBalanceAtDate(lastDayPrev, true);
  }, [activeAccount?.transactions, activeAccount?.recurringTemplates, currentMonth, currentYear, getBalanceAtDate]);

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    const manuals = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const materializedIds = new Set(manuals.map(t => t.templateId).filter(Boolean));
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
    const virtuals: Transaction[] = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !materializedIds.has(tpl.id))
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        return {
          id: `virtual-${tpl.id}-${currentMonth}-${currentYear}`,
          amount: tpl.amount, type: tpl.type, categoryId: tpl.categoryId,
          comment: tpl.comment || (tpl.type === 'INCOME' ? 'Revenu fixe' : 'Charge fixe'),
          date: new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString(),
          isRecurring: true, templateId: tpl.id
        };
      })
      .filter(v => new Date(v.date) > now && !deletedVirtuals.has(v.id));
    return [...manuals, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount?.transactions, activeAccount?.recurringTemplates, currentMonth, currentYear, now]);

  const handleMonthChange = useCallback((offset: number) => {
    setSlideDirection(offset > 0 ? 'next' : 'prev');
    let nm = currentMonth + offset;
    let ny = currentYear;
    if (nm < 0) { nm = 11; ny -= 1; } else if (nm > 11) { nm = 0; ny += 1; }
    setCurrentMonth(nm);
    setCurrentYear(ny);
  }, [currentMonth, currentYear]);

  // SÉCURITÉ : Si l'état n'est pas prêt, on affiche un écran propre au lieu de mouliner
  if (!activeAccount) return <div className="h-screen flex items-center justify-center bg-slate-50 font-bold">Initialisation...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-3 shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo className="w-8 h-8 text-indigo-600" />
            <h1 className="text-lg font-black tracking-tight text-slate-800">ZenBudget</h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
             <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-white rounded-xl text-slate-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg></button>
             <div className="flex flex-col items-center px-3 min-w-[110px]">
                <span className="text-[12px] font-black uppercase tracking-widest text-indigo-700">{MONTHS_FR[currentMonth]}</span>
                <span className="text-[9px] font-black text-slate-400">{currentYear}</span>
             </div>
             <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-white rounded-xl text-slate-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto px-5 py-2 pb-24">
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
            onDelete={(id) => setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === prev.activeAccountId ? { ...a, transactions: a.transactions.filter(t => t.id !== id), deletedVirtualIds: [...(a.deletedVirtualIds || []), id] } : a) }))} 
            onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
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
            state={state} onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))}
            onUpdateAccounts={(accounts) => setState(prev => ({ ...prev, accounts }))} onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
            onReset={() => { if (window.confirm("Tout effacer ?")) { localStorage.clear(); window.location.reload(); } }}
            onUpdateBudget={() => {}} onDeleteAccount={() => {}} onLogout={() => {}}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-2 pb-8 px-6 z-40">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => setActiveView('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
        <NavBtn active={activeView === 'SETTINGS'} onClick={() => setActiveView('SETTINGS')} icon={<IconSettings />} label="Réglages" />
      </nav>

      {showAddModal && <AddTransactionModal categories={state.categories} onClose={() => { setShowAddModal(false); setEditingTransaction(null); }} onAdd={(t) => {
        setState(prev => {
          const accIndex = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
          const acc = { ...prev.accounts[accIndex] };
          const nextTx = [{ ...t, id: generateId() } as Transaction, ...acc.transactions];
          const nextAccounts = [...prev.accounts];
          nextAccounts[accIndex] = { ...acc, transactions: nextTx };
          return { ...prev, accounts: nextAccounts };
        });
        setShowAddModal(false);
      }} initialDate={modalInitialDate} editItem={editingTransaction} />}
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className="w-5 h-5">{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default App;