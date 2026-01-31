import React, { useState, useEffect, useMemo } from 'react';
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
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  // --- MOTEUR DE PROJECTION ---
  const getProjectedBalanceAtDate = (targetDate: Date) => {
    if (!activeAccount) return 0;
    const targetTs = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59).getTime();
    
    let balance = activeAccount.transactions.reduce((acc, t) => {
      const tDate = new Date(t.date).getTime();
      return tDate <= targetTs ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
    const templates = activeAccount.recurringTemplates || [];
    let cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    while (cursor.getTime() <= targetTs) {
      const cM = cursor.getMonth();
      const cY = cursor.getFullYear();
      const paidTemplateIds = new Set(
        activeAccount.transactions
          .filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === cM && d.getFullYear() === cY && t.templateId;
          })
          .map(t => t.templateId)
      );

      templates.forEach(tpl => {
        if (!tpl.isActive || paidTemplateIds.has(tpl.id)) return;
        const day = Math.min(tpl.dayOfMonth, new Date(cY, cM + 1, 0).getDate());
        const tplDateTs = new Date(cY, cM, day, 12, 0, 0).getTime();
        const vId = `virtual-${tpl.id}-${cM}-${cY}`;
        if (tplDateTs <= targetTs && !deletedVirtuals.has(vId)) {
          balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
        }
      });
      cursor.setMonth(cursor.getMonth() + 1);
      if (cursor.getFullYear() > targetDate.getFullYear() + 1) break;
    }
    return balance;
  };

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    const realOnes = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const paidIds = new Set(realOnes.map(t => t.templateId).filter(Boolean));
    const delIds = new Set(activeAccount.deletedVirtualIds || []);

    const virtuals: Transaction[] = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !paidIds.has(tpl.id))
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        return {
          id: `virtual-${tpl.id}-${currentMonth}-${currentYear}`,
          amount: tpl.amount, type: tpl.type, categoryId: tpl.categoryId,
          comment: tpl.comment || "Charge fixe",
          date: new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString(),
          isRecurring: true, templateId: tpl.id
        };
      })
      .filter(v => !delIds.has(v.id));

    return [...realOnes, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear]);

  const balances = useMemo(() => {
    const today = new Date();
    return {
      bank: getProjectedBalanceAtDate(today),
      available: getProjectedBalanceAtDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      projected: getProjectedBalanceAtDate(new Date(currentYear, currentMonth + 1, 0))
    };
  }, [activeAccount, currentMonth, currentYear]);

  const handleMonthChange = (offset: number) => {
    setSlideDirection(offset > 0 ? 'next' : 'prev');
    let m = currentMonth + offset;
    let y = currentYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setCurrentMonth(m);
    setCurrentYear(y);
    setSelectedDay(1);
  };

  const handleUpsert = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    setState(prev => {
      const accIdx = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
      const acc = { ...prev.accounts[accIdx] };
      let newTpls = [...(acc.recurringTemplates || [])];
      let newTx = [...acc.transactions];
      let newDel = [...(acc.deletedVirtualIds || [])];

      let tplId = t.templateId;
      if (t.isRecurring && !tplId) {
        tplId = generateId();
        newTpls.push({ id: tplId, amount: t.amount, type: t.type, categoryId: t.categoryId, dayOfMonth: new Date(t.date).getDate(), isActive: true, comment: t.comment });
      }

      if (t.id?.startsWith('virtual-')) {
        newDel.push(t.id);
        newTx.push({ ...t, id: generateId(), templateId: tplId } as Transaction);
      } else if (t.id) {
        newTx = newTx.map(tx => tx.id === t.id ? ({ ...t, id: t.id, templateId: tplId } as Transaction) : tx);
      } else {
        newTx.push({ ...t, id: generateId(), templateId: tplId } as Transaction);
      }

      const nextAccounts = [...prev.accounts];
      nextAccounts[accIdx] = { ...acc, transactions: newTx, recurringTemplates: newTpls, deletedVirtualIds: newDel };
      return { ...prev, accounts: nextAccounts };
    });
    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] overflow-hidden">
      <header className="bg-white/80 backdrop-blur-md border-b p-4 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-2">
          <IconLogo className="w-8 h-8 text-indigo-600" />
          <h1 className="text-xl font-black italic">ZenBudget</h1>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1 border border-slate-200">
          <button onClick={() => handleMonthChange(-1)} className="p-2 text-slate-400">‹</button>
          <span className="text-[10px] font-black uppercase text-indigo-700 w-24 text-center">{MONTHS_FR[currentMonth]} {currentYear}</span>
          <button onClick={() => handleMonthChange(1)} className="p-2 text-slate-400">›</button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto px-4">
        {activeView === 'DASHBOARD' && (
          <Dashboard 
            transactions={effectiveTransactions} categories={state.categories} 
            activeAccount={activeAccount} checkingAccountBalance={balances.bank}
            availableBalance={balances.available} projectedBalance={balances.projected}
            onSwitchAccount={(id) => setState(prev => ({...prev, activeAccountId: id}))} 
            month={currentMonth} year={currentYear} allAccounts={state.accounts}
            onViewTransactions={() => setActiveView('TRANSACTIONS')} carryOver={0}
          />
        )}
        {activeView === 'TRANSACTIONS' && (
          <TransactionList 
            transactions={effectiveTransactions} categories={state.categories} 
            month={currentMonth} year={currentYear}
            onDelete={(id) => setState(prev => ({...prev, accounts: prev.accounts.map(a => a.id === prev.activeAccountId ? {...a, transactions: a.transactions.filter(tx => tx.id !== id), deletedVirtualIds: id.startsWith('virtual-') ? [...(a.deletedVirtualIds || []), id] : a.deletedVirtualIds} : a)}))}
            onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
            selectedDay={selectedDay} onSelectDay={setSelectedDay}
            totalBalance={balances.projected} carryOver={0}
            cycleEndDay={activeAccount.cycleEndDay || 0}
            onMonthChange={handleMonthChange} slideDirection={slideDirection}
          />
        )}
        {activeView === 'RECURRING' && (
          <RecurringManager 
            recurringTemplates={activeAccount.recurringTemplates || []} 
            categories={state.categories}
            onUpdate={(tpls) => setState(prev => ({...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? {...a, recurringTemplates: tpls} : a)}))}
            totalBalance={balances.projected}
          />
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white/95 backdrop-blur-md border-t flex justify-around p-4 pb-8 z-40">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => setActiveView('RECURRING')} icon={<IconPlus className="rotate-45" />} />
        <NavBtn active={activeView === 'SETTINGS'} onClick={() => setActiveView('SETTINGS')} icon={<IconSettings />} />
      </nav>

      <button 
        onClick={() => { setEditingTransaction(null); setShowAddModal(true); }}
        className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center z-50 border-4 border-white active:scale-90 transition-transform"
      >
        <IconPlus className="w-8 h-8" />
      </button>

      {showAddModal && (
        <AddTransactionModal 
          categories={state.categories} 
          onClose={() => setShowAddModal(false)} 
          onAdd={handleUpsert} 
          editItem={editingTransaction}
          initialDate={new Date(currentYear, currentMonth, selectedDay || 1, 12).toISOString()}
        />
      )}
    </div>
  );
};

const NavBtn = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`p-2 rounded-xl transition-colors ${active ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
    <div className="w-6 h-6">{icon}</div>
  </button>
);

const container = document.getElementById('root');
if (container) createRoot(container).render(<App />);
export default App;