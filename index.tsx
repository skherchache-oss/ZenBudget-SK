import React, { useState, useEffect, useMemo, useRef } from 'react';
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

  // --- 1. SAUVEGARDE STABILISÉE (Anti-boucle) ---
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => saveState(state), 1000);
    return () => clearTimeout(timer);
  }, [state]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  // --- 2. CALCULS DE SOLDES SÉCURISÉS ---
  // On fixe "now" au début de la fonction pour éviter les variations de millisecondes
  const now = useMemo(() => new Date(), [currentMonth, currentYear, activeView]);

  const getBalanceAtDate = (targetDate: Date, includeProjections: boolean) => {
    if (!activeAccount) return 0;
    
    // Solde des transactions réelles
    let balance = activeAccount.transactions.reduce((acc, t) => {
      return new Date(t.date) <= targetDate ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    // Ajout des projections (charges fixes non encore passées)
    if (includeProjections && targetDate > now) {
      const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
      const templates = activeAccount.recurringTemplates || [];
      
      // On parcourt les mois du curseur jusqu'à la date cible
      let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
      const limit = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);

      while (cursor < limit) {
        const cMonth = cursor.getMonth();
        const cYear = cursor.getFullYear();
        
        const materializedIds = new Set(
          activeAccount.transactions
            .filter(t => {
              const d = new Date(t.date);
              return d.getMonth() === cMonth && d.getFullYear() === cYear;
            })
            .map(t => t.templateId)
        );

        templates.forEach(tpl => {
          if (!tpl.isActive || materializedIds.has(tpl.id)) return;
          
          const day = Math.min(tpl.dayOfMonth, new Date(cYear, cMonth + 1, 0).getDate());
          const tplDate = new Date(cYear, cMonth, day, 12, 0, 0);
          const vId = `virtual-${tpl.id}-${cMonth}-${cYear}`;

          if (tplDate > now && tplDate <= targetDate && !deletedVirtuals.has(vId)) {
            balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
          }
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    return balance;
  };

  // --- 3. MEMOIZATION DES SOLDES ---
  const checkingAccountBalance = useMemo(() => getBalanceAtDate(now, false), [activeAccount, now]);

  const availableBalance = useMemo(() => {
    const cycleDay = activeAccount?.cycleEndDay || 0;
    let target = new Date(now.getFullYear(), now.getMonth(), cycleDay || new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), 23, 59, 59);
    if (now > target) target.setMonth(target.getMonth() + 1);
    return getBalanceAtDate(target, true);
  }, [activeAccount, now]);

  const projectedBalance = useMemo(() => {
    const lastDay = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return getBalanceAtDate(lastDay, true);
  }, [activeAccount, currentMonth, currentYear, now]);

  const carryOver = useMemo(() => {
    const dayBefore = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    return getBalanceAtDate(dayBefore, true);
  }, [activeAccount, currentMonth, currentYear, now]);

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    const manuals = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const materializedIds = new Set(manuals.map(t => t.templateId));
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);

    const virtuals = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !materializedIds.has(tpl.id))
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        const vDate = new Date(currentYear, currentMonth, day, 12, 0, 0);
        return {
          id: `virtual