
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppState, ViewType, Transaction, Category, RecurringTemplate, BudgetAccount } from './types';
import { getInitialState, saveState, generateId } from './store';
import { MONTHS_FR } from './constants';
import { IconPlus, IconHome, IconCalendar, IconLogo, IconSettings } from './components/Icons';

import Dashboard from './components/Dashboard';
import RecurringManager from './components/RecurringManager';
import TransactionList from './components/TransactionList';
import AddTransactionModal from './components/AddTransactionModal';
import Settings from './components/Settings';

// --- FONCTIONS DE CALCUL ROBUSTES ---

const getCycleEndDate = (year: number, month: number, daySetting: number = 0) => {
  if (daySetting <= 0 || daySetting > 28) {
    return new Date(year, month + 1, 0, 23, 59, 59);
  }
  return new Date(year, month, daySetting, 23, 59, 59);
};

const getBalanceAtDate = (activeAccount: BudgetAccount | undefined, targetDate: Date, includeProjections: boolean) => {
  if (!activeAccount) return 0;
  const now = new Date();
  
  // 1. Transactions réelles (saisies manuellement)
  let balance = activeAccount.transactions.reduce((acc, t) => {
    return new Date(t.date) <= targetDate ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
  }, 0);

  // 2. Charges Fixes Virtuelles (Templates non matérialisés)
  if (includeProjections) {
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
    const templates = activeAccount.recurringTemplates || [];
    
    // On analyse à partir du début du mois courant jusqu'à targetDate
    let cursor = new Date(now.getFullYear(), now.getMonth(), 1);

    while (cursor <= targetDate) {
      const cM = cursor.getMonth();
      const cY = cursor.getFullYear();
      
      const materializedIds = new Set(
        activeAccount.transactions
          .filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === cM && d.getFullYear() === cY;
          })
          .map(t => t.templateId).filter(Boolean)
      );

      templates.forEach(tpl => {
        if (!tpl.isActive || materializedIds.has(tpl.id)) return;
        
        const day = Math.min(tpl.dayOfMonth, new Date(cY, cM + 1, 0).getDate());
        const tplDate = new Date(cY, cM, day, 12, 0, 0);
        const vId = `virtual-${tpl.id}-${cM}-${cY}`;
        
        // On compte si c'est APRÈS "maintenant" (car avant c'est supposé réglé ou réel)
        if (tplDate > now && tplDate <= targetDate && !deletedVirtuals.has(vId)) {
          balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
        }
      });
      cursor.setMonth(cursor.getMonth() + 1);
      if (cursor.getFullYear() > now.getFullYear() + 2) break;
    }
  }
  return balance;
};

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
    saveState(state);
  }, [state]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const checkingAccountBalance = useMemo(() => {
    return getBalanceAtDate(activeAccount, new Date(), false);
  }, [activeAccount]);

  const availableBalance = useMemo(() => {
    const today = new Date();
    const cycleDay = activeAccount?.cycleEndDay || 0;
    let target = getCycleEndDate(today.getFullYear(), today.getMonth(), cycleDay);
    if (today > target) {
      target = getCycleEndDate(today.getFullYear(), today.getMonth() + 1, cycleDay);
    }
    return getBalanceAtDate(activeAccount, target, true);
  }, [activeAccount]);

  const projectedBalance = useMemo(() => {
    const target = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return getBalanceAtDate(activeAccount, target, true);
  }, [activeAccount, currentMonth, currentYear]);

  const carryOver = useMemo(() => {
    const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    return getBalanceAtDate(activeAccount, lastDayOfPrevMonth, true);
  }, [activeAccount, currentMonth, currentYear]);

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    const now = new Date();
    
    // 1. Transactions réelles du mois
    const manuals = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const materializedIds = new Set(manuals.map(t => t.templateId).filter(Boolean));
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);

    // 2. Projections virtuelles du mois sélectionné
    const virtuals: Transaction[] = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !materializedIds.has(tpl.id))
      .map(tpl => {
        const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        const day = Math.min(tpl.dayOfMonth, lastDay);
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
      .filter(v => {
        const vDate = new Date(v.date);
        // On affiche les virtuelles si elles sont dans le futur (ou aujourd'hui) et non supprimées
        return vDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && !deletedVirtuals.has(v.id);
      });

    return [...manuals, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear]);

  const handleMonthChange = useCallback((offset: number) => {
    setSlideDirection(offset > 0 ? 'next' : 'prev');
    setCurrentMonth(prevMonth => {
      let nextMonth = prevMonth + offset;
      if (nextMonth < 0) {
        setCurrentYear(y => y - 1);
        return 11;
      } else if (nextMonth > 11) {
        setCurrentYear(y => y + 1);
        return 0;
      }
      return nextMonth;
    });
    setSelectedDay(1);
  }, []);

  const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    setState(prev => {
      const accIndex = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
      if (accIndex === -1) return prev;
      const acc = { ...prev.accounts[accIndex] };
      let nextTx = [...acc.transactions];
      let nextTemplates = [...(acc.recurringTemplates || [])];
      let nextDeleted = [...(acc.deletedVirtualIds || [])];
      
      const targetId = t.id || editingTransaction?.id;
      const isVirtual = targetId?.toString().startsWith('virtual-');
      const templateId = t.templateId || (isVirtual ? targetId?.toString().split('-')[1] : undefined);

      if (t.isRecurring && templateId) {
        nextTemplates = nextTemplates.map(tpl => tpl.id === templateId ? { ...tpl, amount: t.amount, categoryId: t.categoryId, comment: t.comment, type: t.type } : tpl);
      }

      if (targetId && !isVirtual && nextTx.some(i => i.id === targetId)) {
        nextTx = nextTx.map(i => i.id === targetId ? ({ ...t, id: targetId, templateId } as Transaction) : i);
      } else {
        if (isVirtual && targetId) nextDeleted.push(targetId);
        nextTx = [{ ...t, id: generateId(), templateId } as Transaction, ...nextTx];
      }

      const nextAccounts = [...prev.accounts];
      nextAccounts[accIndex] = { ...acc, transactions: nextTx, recurringTemplates: nextTemplates, deletedVirtualIds: nextDeleted };
      return { ...prev, accounts: nextAccounts };
    });
    setShowAddModal(false);
    setEditingTransaction(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-3 shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo className="w-8 h-8" />
            <h1 className="text-lg font-black tracking-tight text-slate-800">ZenBudget</h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
             <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-white rounded-xl text-slate-400 active:scale-90 transition-transform"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg></button>
             <div className="flex flex-col items-center px-4 min-w-[100px]">
                <span className="text-[12px] font-black uppercase tracking-widest text-indigo-700">{MONTHS_FR[currentMonth]}</span>
                <span className="text-[9px] font-black text-slate-300">{currentYear}</span>
             </div>
             <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-white rounded-xl text-slate-400 active:scale-90 transition-transform"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg></button>
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
          <div className="h-full overflow-y-auto no-scrollbar">
            <TransactionList 
              transactions={effectiveTransactions} categories={state.categories} month={currentMonth} year={currentYear}
              onDelete={(id) => setState(prev => {
                const accIndex = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
                const acc = { ...prev.accounts[accIndex] };
                let nextTx = acc.transactions.filter(t => t.id !== id);
                let nextDeleted = [...(acc.deletedVirtualIds || [])];
                if (id.startsWith('virtual-')) nextDeleted.push(id);
                const nextAccounts = [...prev.accounts];
                nextAccounts[accIndex] = { ...acc, transactions: nextTx, deletedVirtualIds: nextDeleted };
                return { ...prev, accounts: nextAccounts };
              })} 
              onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
              onAddAtDate={(date) => { setModalInitialDate(date); setShowAddModal(true); }}
              selectedDay={selectedDay} onSelectDay={setSelectedDay} totalBalance={projectedBalance}
              carryOver={carryOver} cycleEndDay={activeAccount?.cycleEndDay || 0}
              onMonthChange={handleMonthChange} slideDirection={slideDirection}
            />
          </div>
        )}
        {activeView === 'RECURRING' && (
          <div className="h-full overflow-y-auto no-scrollbar">
            <RecurringManager 
              recurringTemplates={activeAccount?.recurringTemplates || []} categories={state.categories}
              onUpdate={(templates) => setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, recurringTemplates: templates } : a) }))}
              totalBalance={projectedBalance}
            />
          </div>
        )}
        {activeView === 'SETTINGS' && (
          <div className="h-full overflow-y-auto no-scrollbar">
            <Settings 
              state={state} onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))}
              onUpdateAccounts={(accounts) => setState(prev => ({ ...prev, accounts }))} onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
              onReset={() => { if (window.confirm("Tout effacer définitivement ?")) { localStorage.clear(); window.location.reload(); } }}
              onUpdateBudget={() => {}} onDeleteAccount={(id) => {
                setState(prev => {
                  const nextAccs = prev.accounts.filter(a => a.id !== id);
                  if (nextAccs.length === 0) return prev;
                  return { ...prev, accounts: nextAccs, activeAccountId: id === prev.activeAccountId ? nextAccs[0].id : prev.activeAccountId };
                });
              }} onLogout={() => {}}
            />
          </div>
        )}
      </main>

      <button onClick={() => { setEditingTransaction(null); setModalInitialDate(new Date(currentYear, currentMonth, selectedDay || 1, 12, 0, 0).toISOString()); setShowAddModal(true); }} 
        className="fixed bottom-[110px] right-6 w-14 h-14 bg-slate-900 text-white rounded-[22px] shadow-2xl flex items-center justify-center active:scale-90 z-40 border-4 border-white transition-all"><IconPlus className="w-7 h-7" /></button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-3 pb-8 px-6 z-40">
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
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-indigo-600 scale-105' : 'text-slate-400 opacity-60'}`}>
    <div className="w-5 h-5">{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default App;
