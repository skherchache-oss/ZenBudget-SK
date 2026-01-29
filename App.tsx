
import React, { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    saveState(state);
  }, [state]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const now = new Date();

  /**
   * FONCTION DE CALCUL UNIQUE (Source de vérité)
   * Calcule le solde à une date précise en incluant ou non les projections virtuelles.
   */
  const getBalanceAtDate = (targetDate: Date, includeProjections: boolean) => {
    if (!activeAccount) return 0;
    
    // 1. Somme des transactions réelles (Journal) JUSQU'À la date cible
    let balance = activeAccount.transactions.reduce((acc, t) => {
      const tDate = new Date(t.date);
      if (tDate <= targetDate) {
        return acc + (t.type === 'INCOME' ? t.amount : -t.amount);
      }
      return acc;
    }, 0);

    // 2. Si projections activées, on ajoute les charges virtuelles entre MAINTENANT et la DATE CIBLE
    if (includeProjections && targetDate > now) {
      const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
      
      // On itère mois par mois entre maintenant et la date cible
      let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
      while (cursor <= targetDate) {
        const cMonth = cursor.getMonth();
        const cYear = cursor.getFullYear();
        
        // On récupère les IDs déjà matérialisés pour ce mois spécifique
        const manualsInMonth = activeAccount.transactions.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === cMonth && d.getFullYear() === cYear;
        });
        const materializedIds = new Set(manualsInMonth.map(t => t.templateId).filter(Boolean));

        (activeAccount.recurringTemplates || []).forEach(tpl => {
          if (!tpl.isActive || materializedIds.has(tpl.id)) return;
          
          const day = Math.min(tpl.dayOfMonth, new Date(cYear, cMonth + 1, 0).getDate());
          const tplDate = new Date(cYear, cMonth, day, 12, 0, 0);
          const vId = `virtual-${tpl.id}-${cMonth}-${cYear}`;

          // On n'ajoute que si la date de la charge est comprise entre MAINTENANT et la DATE CIBLE
          if (tplDate > now && tplDate <= targetDate && !deletedVirtuals.has(vId)) {
            balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
          }
        });

        // Mois suivant
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    return balance;
  };

  // --- VARIABLES CALCULÉES ---

  // Solde Bancaire Réel (Opérations passées uniquement)
  const checkingAccountBalance = useMemo(() => getBalanceAtDate(now, false), [activeAccount, now]);

  // Disponible Réel (Solde actuel - Charges prévues fin du mois en cours)
  const availableBalance = useMemo(() => {
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return getBalanceAtDate(endOfCurrentMonth, true);
  }, [activeAccount, now]);

  // Solde Projeté (Atterrissage fin du mois affiché)
  const projectedBalance = useMemo(() => {
    const endOfViewMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return getBalanceAtDate(endOfViewMonth, true);
  }, [activeAccount, currentMonth, currentYear, now]);

  // Report (Solde au début du mois affiché pour le Journal)
  const carryOver = useMemo(() => {
    const startOfViewMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0);
    // On enlève 1 milliseconde pour avoir le solde à la veille
    const dayBefore = new Date(startOfViewMonth.getTime() - 1);
    return getBalanceAtDate(dayBefore, true);
  }, [activeAccount, currentMonth, currentYear, now]);

  // Préparation des transactions du mois (Journal)
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
        const vId = `virtual-${tpl.id}-${currentMonth}-${currentYear}`;
        return {
          id: vId,
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
        // On n'affiche les virtuelles QUE si elles sont dans le futur
        return vDate > now && !deletedVirtuals.has(v.id);
      });

    return [...manuals, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear, now]);

  // --- ACTIONS ---

  const handleMonthChange = (offset: number) => {
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
        nextTemplates = nextTemplates.map(tpl => tpl.id === templateId ? {
          ...tpl, amount: t.amount, categoryId: t.categoryId, comment: t.comment, type: t.type
        } : tpl);
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
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-3 safe-top shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo className="w-8 h-8" />
            <h1 className="text-lg font-black tracking-tight text-slate-800 font-logo">ZenBudget</h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200 scale-90 origin-right transition-all">
             <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-white rounded-full transition-all text-slate-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg></button>
             <span className="text-[9px] font-black uppercase tracking-widest px-2 min-w-[90px] text-center text-slate-600">{MONTHS_FR[currentMonth]} {currentYear}</span>
             <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-white rounded-full transition-all text-slate-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto px-5 py-2 pb-24">
        {activeView === 'DASHBOARD' && (
          <Dashboard 
            transactions={effectiveTransactions} categories={state.categories} activeAccount={activeAccount} allAccounts={state.accounts}
            onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} month={currentMonth} year={currentYear}
            onViewTransactions={() => setActiveView('TRANSACTIONS')} checkingAccountBalance={checkingAccountBalance} availableBalance={availableBalance} projectedBalance={projectedBalance}
          />
        )}
        {activeView === 'TRANSACTIONS' && (
          <div className="h-full overflow-y-auto no-scrollbar">
            <TransactionList 
              transactions={effectiveTransactions} categories={state.categories} month={currentMonth} year={currentYear}
              onDelete={handleDeleteTransaction} onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
              onAddAtDate={(date) => { setModalInitialDate(date); setShowAddModal(true); }}
              selectedDay={selectedDay} onSelectDay={setSelectedDay} totalBalance={projectedBalance}
              carryOver={carryOver}
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
              state={state} onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))} onUpdateBudget={() => {}}
              onUpdateAccounts={(accounts) => setState(prev => ({ ...prev, accounts }))} onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
              onDeleteAccount={(id) => setState(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id) }))}
              onReset={() => { if (window.confirm("Tout effacer ?")) { localStorage.clear(); window.location.reload(); } }} onLogout={() => {}}
            />
          </div>
        )}
      </main>

      <button onClick={() => { setEditingTransaction(null); setModalInitialDate(selectedDay ? new Date(currentYear, currentMonth, selectedDay, 12, 0, 0).toISOString() : new Date().toISOString()); setShowAddModal(true); }} 
        className="fixed bottom-[100px] right-6 w-14 h-14 bg-slate-900 text-white rounded-[22px] shadow-2xl flex items-center justify-center active:scale-90 z-40 border-4 border-white transition-all"><IconPlus className="w-7 h-7" /></button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] px-6 z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.02)]">
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
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
    <div className={`w-5 h-5 ${active ? 'scale-110' : 'scale-100'} transition-transform`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
  </button>
);

export default App;
