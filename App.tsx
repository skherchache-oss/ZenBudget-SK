import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, ViewType, Transaction, Category, RecurringTemplate, BudgetAccount } from './types';
// Ces fonctions gèrent déjà le localStorage via ton fichier store.ts
import { getInitialState, saveState, generateId } from './store';
import { MONTHS_FR } from './constants';
import { IconPlus, IconHome, IconCalendar, IconLogo, IconSettings } from './components/Icons';

import Dashboard from './components/Dashboard';
import RecurringManager from './components/RecurringManager';
import TransactionList from './components/TransactionList';
import AddTransactionModal from './components/AddTransactionModal';
import Settings from './components/Settings';

const App: React.FC = () => {
  // INITIALISATION : Récupère les données du localStorage au chargement
  const [state, setState] = useState<AppState>(() => getInitialState());
  const [activeView, setActiveView] = useState<ViewType>('DASHBOARD');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(new Date().toISOString());
  
  const isResetting = useRef(false);

  // SAUVEGARDE AUTOMATIQUE : À chaque modification de 'state', on écrit dans le localStorage
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
    // Cette fonction déclenche setState, qui déclenche automatiquement saveState via le useEffect
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
      localStorage.removeItem('zenbudget_state'); // Utilise la clé exacte définie dans store.ts
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
               {MONTHS_FR[currentMonth]}
             </span>
             <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-white rounded-full transition-all active:scale-90 text-slate-400">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7