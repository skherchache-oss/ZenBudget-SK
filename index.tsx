import React, { useState, useEffect, useMemo, useRef } from 'react';
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

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  // SAUVEGARDE AUTOMATIQUE
  useEffect(() => {
    saveState(state);
  }, [state]);

  // --- MOTEUR DE CALCUL UNIVERSEL ---
  const getProjectedBalanceAtDate = (targetDate: Date) => {
    if (!activeAccount) return 0;
    
    const targetTs = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59).getTime();

    // 1. Calcul du cumul des transactions RÉELLES (passées et futures déjà saisies)
    let balance = activeAccount.transactions.reduce((acc, t) => {
      const tDate = new Date(t.date).getTime();
      return tDate <= targetTs ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    // 2. Projection des charges VIRTUELLES (Templates non encore payés)
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
    const templates = activeAccount.recurringTemplates || [];
    
    // On démarre le scan au début du mois actuel
    let cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    while (cursor.getTime() <= targetTs) {
      const cM = cursor.getMonth();
      const cY = cursor.getFullYear();

      // On identifie les templates déjà "matérialisés" par une transaction réelle ce mois-ci
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
        const tplDate = new Date(cY, cM, day, 12, 0, 0);
        const vId = `virtual-${tpl.id}-${cM}-${cY}`;

        // On n'ajoute la charge que si elle est dans la fenêtre de temps et non supprimée
        if (tplDate.getTime() <= targetTs && !deletedVirtuals.has(vId)) {
          balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
        }
      });

      cursor.setMonth(cursor.getMonth() + 1);
      if (cursor.getFullYear() > targetDate.getFullYear() + 2) break; // Sécurité 2 ans
    }
    return balance;
  };

  // --- TRANSACTIONS EFFECTIVES DU MOIS ---
  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    
    // Transactions réelles du mois
    const realOnes = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const paidIds = new Set(realOnes.map(t => t.templateId).filter(Boolean));
    const delIds = new Set(activeAccount.deletedVirtualIds || []);

    // Génération des virtuelles manquantes
    const virtuals: Transaction[] = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !paidIds.has(tpl.id))
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        const vId = `virtual-${tpl.id}-${currentMonth}-${currentYear}`;
        return {
          id: vId,
          amount: tpl.amount,
          type: tpl.type,
          categoryId: tpl.categoryId,
          comment: tpl.comment || "Charge fixe",
          date: new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString(),
          isRecurring: true,
          templateId: tpl.id
        };
      })
      .filter(v => !delIds.has(v.id));

    return [...realOnes, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear]);

  // --- LOGIQUE DE SAISIE (JOURNAL -> FIXES) ---
  const handleUpsert = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    setState(prev => {
      const accIdx = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
      const acc = { ...prev.accounts[accIdx] };
      let newTpls = [...(acc.recurringTemplates || [])];
      let newTx = [...acc.transactions];
      let newDel = [...(acc.deletedVirtualIds || [])];

      // 1. Si c'est une récurrente mais qu'aucun template n'existe, on le crée
      let tplId = t.templateId;
      if (t.isRecurring && !tplId) {
        tplId = generateId();
        const newTemplate: RecurringTemplate = {
          id: tplId,
          amount: t.amount,
          type: t.type,
          categoryId: t.categoryId,
          dayOfMonth: new Date(t.date).getDate(),
          isActive: true,
          comment: t.comment
        };
        newTpls.push(newTemplate);
      }

      // 2. Gestion de la transaction (Virtuelle -> Réelle ou Update)
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

  // --- CALCULS DE SOLDES ---
  const balances = useMemo(() => {
    const today = new Date();
    const endMo = new Date(currentYear, currentMonth + 1, 0);
    return {
      bank: getProjectedBalanceAtDate(today),
      available: getProjectedBalanceAtDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      projected: getProjectedBalanceAtDate(endMo)
    };
  }, [activeAccount, currentMonth, currentYear]);

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] overflow-hidden">
      <header className="bg-white border-b p-4 flex justify-between items-center">
        <IconLogo className="w-8 h-8 text-indigo-600" />
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
          <button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} className="px-2">‹</button>
          <span className="text-[10px] font-bold uppercase">{MONTHS_FR[currentMonth]} {currentYear}</span>
          <button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} className="px-2">›</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 px-4">
        {activeView === 'DASHBOARD' && (
          <Dashboard 
            transactions={effectiveTransactions} categories={state.categories} 
            activeAccount={activeAccount} checkingAccountBalance={balances.bank}
            availableBalance={balances.available} projectedBalance={balances.projected}
            onSwitchAccount={() => {}} month={currentMonth} year={currentYear}
            onViewTransactions={() => setActiveView('TRANSACTIONS')} allAccounts={state.accounts}
            carryOver={0}
          />
        )}
        {activeView === 'TRANSACTIONS' && (
          <TransactionList 
            transactions={effectiveTransactions} categories={state.categories} 
            onDelete={(id) => {}} onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
            // ... autres props
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

      <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-4">
        <button onClick={() => setActiveView('DASHBOARD')} className={activeView === 'DASHBOARD' ? 'text-indigo-600' : 'text-slate-400'}><IconHome /></button>
        <button onClick={() => setActiveView('TRANSACTIONS')} className={activeView === 'TRANSACTIONS' ? 'text-indigo-600' : 'text-slate-400'}><IconCalendar /></button>
        <button onClick={() => setActiveView('RECURRING')} className={activeView === 'RECURRING' ? 'text-indigo-600' : 'text-slate-400'}><IconPlus /></button>
      </nav>

      {showAddModal && (
        <AddTransactionModal 
          categories={state.categories} 
          onClose={() => setShowAddModal(false)} 
          onAdd={handleUpsert} 
          editItem={editingTransaction}
        />
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) createRoot(container).render(<App />);
export default App;