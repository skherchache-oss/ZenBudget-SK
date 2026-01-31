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
    saveState(state);
  }, [state]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  // --- MOTEUR DE CALCUL DE SOLDE ---
  const getBalanceAtDate = (targetDate: Date, includeProjections: boolean) => {
    if (!activeAccount) return 0;
    
    // 1. Somme du RÉEL
    let balance = activeAccount.transactions.reduce((acc, t) => {
      return new Date(t.date) <= targetDate ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    // 2. Injection des FIXES
    if (includeProjections) {
      const templates = activeAccount.recurringTemplates || [];
      const deletedIds = new Set(activeAccount.deletedVirtualIds || []);
      
      // On calcule mois par mois du passé vers le futur
      let scanDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      while (scanDate <= targetDate) {
        const m = scanDate.getMonth();
        const y = scanDate.getFullYear();

        // On identifie les templates déjà payés ce mois-ci
        const paidTemplateIds = new Set(
          activeAccount.transactions
            .filter(t => {
              const d = new Date(t.date);
              return d.getMonth() === m && d.getFullYear() === y && t.templateId;
            })
            .map(t => t.templateId)
        );

        templates.forEach(tpl => {
          if (!tpl.isActive || paidTemplateIds.has(tpl.id)) return;
          
          const day = Math.min(tpl.dayOfMonth, new Date(y, m + 1, 0).getDate());
          const tplDate = new Date(y, m, day, 12, 0, 0);
          const vId = `virtual-${tpl.id}-${m}-${y}`;

          if (tplDate <= targetDate && !deletedIds.has(vId)) {
            balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
          }
        });
        scanDate.setMonth(scanDate.getMonth() + 1);
      }
    }
    return balance;
  };

  const checkingAccountBalance = useMemo(() => getBalanceAtDate(now, false), [activeAccount]);
  const availableBalance = useMemo(() => getBalanceAtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0), true), [activeAccount]);
  const projectedBalance = useMemo(() => getBalanceAtDate(new Date(currentYear, currentMonth + 1, 0), true), [activeAccount, currentMonth, currentYear]);
  const carryOver = useMemo(() => getBalanceAtDate(new Date(currentYear, currentMonth, 0), true), [activeAccount, currentMonth, currentYear]);

  // --- GÉNÉRATION DE LA LISTE DE TRANSACTIONS ---
  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    
    const realOnes = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const paidIds = new Set(realOnes.map(t => t.templateId).filter(Boolean));
    const deletedIds = new Set(activeAccount.deletedVirtualIds || []);

    const virtuals = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !paidIds.has(tpl.id))
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
        } as Transaction;
      })
      .filter(v => !deletedIds.has(v.id));

    return [...realOnes, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear]);

  // --- ACTIONS ---
  const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    setState(prev => {
      const accIndex = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
      if (accIndex === -1) return prev;
      
      const acc = { ...prev.accounts[accIndex] };
      let nextTx = [...acc.transactions];
      let nextDeleted = [...(acc.deletedVirtualIds || [])];
      
      const targetId = t.id || editingTransaction?.id;
      const isVirtual = targetId?.startsWith('virtual-');

      if (isVirtual) {
        // Si c'était une virtuelle, on la supprime de la projection et on crée une réelle
        nextDeleted.push(targetId!);
        // On s'assure que la nouvelle transaction porte bien l'ID du template d'origine
        const originalTemplateId = targetId?.split('-')[1];
        nextTx = [{ ...t, id: generateId(), templateId: originalTemplateId } as Transaction, ...nextTx];
      } else if (targetId && nextTx.some(i => i.id === targetId)) {
        nextTx = nextTx.map(i => i.id === targetId ? ({ ...t, id: targetId } as Transaction) : i);
      } else {
        nextTx = [{ ...t, id: generateId() } as Transaction, ...nextTx];
      }

      const nextAccounts = [...prev.accounts];
      nextAccounts[accIndex] = { ...acc, transactions: nextTx, deletedVirtualIds: nextDeleted };
      return { ...prev, accounts: nextAccounts };
    });
    setShowAddModal(false);
    setEditingTransaction(null);
  };

  const handleMonthChange = (offset: number) => {
    let m = currentMonth + offset;
    let y = currentYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setCurrentMonth(m);
    setCurrentYear(y);
    setSlideDirection(offset > 0 ? 'next' : 'prev');
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo className="w-8 h-8 text-indigo-600" />
            <h1 className="text-xl font-black tracking-tighter">ZenBudget</h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
             <button onClick={() => handleMonthChange(-1)} className="p-2 text-slate-400">‹</button>
             <span className="text-[11px] font-black uppercase tracking-widest text-indigo-700 px-2">
               {MONTHS_FR[currentMonth]} {currentYear}
             </span>
             <button onClick={() => handleMonthChange(1)} className="p-2 text-slate-400">›</button>
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
            onDelete={(id) => setState(prev => {
                const idx = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
                const acc = prev.accounts[idx];
                return {
                    ...prev,
                    accounts: prev.accounts.map(a => a.id === acc.id ? {
                        ...a,
                        transactions: a.transactions.filter(tx => tx.id !== id),
                        deletedVirtualIds: id.startsWith('virtual-') ? [...(a.deletedVirtualIds || []), id] : a.deletedVirtualIds
                    } : a)
                };
            })}
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
            state={state} onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))} onUpdateBudget={() => {}}
            onUpdateAccounts={(accounts) => setState(prev => ({ ...prev, accounts }))} onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
            onDeleteAccount={() => {}} onReset={() => { localStorage.clear(); window.location.reload(); }} onLogout={() => {}}
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
}

export default App;