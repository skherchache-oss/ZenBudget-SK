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
  
  const now = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<string>(new Date().toISOString());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  const isInitialMount = useRef(true);
  const isResetting = useRef(false);
  
  // --- GESTION DU BOUTON RETOUR ---
  useEffect(() => {
    window.history.replaceState({ view: 'DASHBOARD' }, '', '#dashboard');
    const handlePopState = (event: PopStateEvent) => {
      if (showAddModal) { setShowAddModal(false); setEditingTransaction(null); return; }
      if (showWelcome) { setShowWelcome(false); return; }
      if (event.state && event.state.view) setActiveView(event.state.view);
      else setActiveView('DASHBOARD');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showAddModal, showWelcome]);

  const navigateTo = (view: ViewType) => {
    if (view !== activeView) {
      const hash = view.toLowerCase();
      window.history.pushState({ view }, '', `#${hash}`);
      setActiveView(view);
    }
  };

  useEffect(() => {
    if (showAddModal || showWelcome) {
      window.history.pushState({ modalOpen: true, view: activeView }, '', window.location.hash);
    }
  }, [showAddModal, showWelcome]);

  // --- PERSISTANCE ---
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (isResetting.current) return;
    saveState(state);
  }, [state]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const getBalanceAtDate = (targetDate: Date, includeProjections: boolean) => {
    if (!activeAccount) return 0;
    let balance = activeAccount.transactions.reduce((acc, t) => {
      const tDate = new Date(t.date);
      if (tDate.getTime() <= targetDate.getTime()) {
        const amount = Math.abs(t.amount);
        return acc + (t.type === 'INCOME' ? amount : -amount);
      }
      return acc;
    }, 0);

    if (includeProjections) {
      const templates = activeAccount.recurringTemplates || [];
      const deletedIds = new Set(activeAccount.deletedVirtualIds || []);
      const startProj = new Date(now.getFullYear(), now.getMonth(), 1);
      let scanDate = new Date(startProj);
      while (scanDate <= targetDate) {
        const m = scanDate.getMonth();
        const y = scanDate.getFullYear();
        const paidTemplateIds = new Set(activeAccount.transactions.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === m && d.getFullYear() === y && t.templateId;
        }).map(t => t.templateId));

        templates.forEach(tpl => {
          if (!tpl.isActive || paidTemplateIds.has(tpl.id)) return;
          const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
          const day = Math.min(tpl.dayOfMonth, lastDayOfMonth);
          const vDate = new Date(y, m, day, 12, 0, 0);
          const vId = `virtual-${tpl.id}-${m}-${y}`;
          if (vDate.getTime() <= targetDate.getTime() && vDate.getTime() >= startProj.getTime() && !deletedIds.has(vId)) {
            balance += (tpl.type === 'INCOME' ? Math.abs(tpl.amount) : -Math.abs(tpl.amount));
          }
        });
        scanDate.setMonth(scanDate.getMonth() + 1);
      }
    }
    return balance;
  };

  const cycleEndDate = useMemo(() => {
    const day = activeAccount?.cycleEndDay || 0;
    if (day === 0) return new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    return new Date(currentYear, currentMonth, Math.min(day, lastDayOfMonth), 23, 59, 59);
  }, [activeAccount?.cycleEndDay, currentMonth, currentYear]);

  const projectedBalance = useMemo(() => 
    getBalanceAtDate(new Date(currentYear, currentMonth + 1, 0, 23, 59, 59), true), 
    [activeAccount, currentMonth, currentYear]
  );

  const availableBalance = useMemo(() => 
    getBalanceAtDate(cycleEndDate, true),
    [activeAccount, currentMonth, currentYear, cycleEndDate]
  );
  
  const carryOver = useMemo(() => 
    getBalanceAtDate(new Date(currentYear, currentMonth, 0, 23, 59, 59), true), 
    [activeAccount, currentMonth, currentYear]
  );

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    const realOnes = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const paidIds = new Set(realOnes.map(t => t.templateId).filter(Boolean));
    const deletedIds = new Set(activeAccount.deletedVirtualIds || []);
    const isPast = new Date(currentYear, currentMonth + 1, 0).getTime() < new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const virtuals = !isPast ? (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !paidIds.has(tpl.id))
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        const vId = `virtual-${tpl.id}-${currentMonth}-${currentYear}`;
        return {
          id: vId, amount: Math.abs(tpl.amount), type: tpl.type, categoryId: tpl.categoryId,
          comment: tpl.comment || (tpl.type === 'INCOME' ? 'Revenu fixe' : 'Charge fixe'),
          date: new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString(),
          isRecurring: true, templateId: tpl.id
        } as Transaction;
      }).filter(v => !deletedIds.has(v.id)) : [];
    return [...realOnes, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear]);

  const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    setState(prev => {
      const accId = prev.activeAccountId || prev.accounts[0]?.id;
      const accIndex = prev.accounts.findIndex(a => a.id === accId);
      if (accIndex === -1) return prev;
      const acc = { ...prev.accounts[accIndex] };
      let nextTx = [...acc.transactions];
      let nextTemplates = [...(acc.recurringTemplates || [])];
      let nextDeleted = [...(acc.deletedVirtualIds || [])];
      
      const cleanTransaction = { ...t, amount: Math.abs(t.amount) };
      const targetId = t.id || editingTransaction?.id;

      let currentTemplateId = t.templateId || editingTransaction?.templateId;
      if (targetId?.startsWith('virtual-')) {
        currentTemplateId = targetId.split('-')[1];
      }

      if (currentTemplateId) {
        nextTemplates = nextTemplates.map(tpl => 
          tpl.id === currentTemplateId 
            ? { 
                ...tpl, 
                amount: cleanTransaction.amount, 
                categoryId: cleanTransaction.categoryId, 
                comment: cleanTransaction.comment, 
                type: cleanTransaction.type,
                dayOfMonth: new Date(cleanTransaction.date).getDate()
              } 
            : tpl
        );
      } else if (t.isRecurring && !targetId) {
        const newTplId = generateId();
        currentTemplateId = newTplId;
        nextTemplates.push({ 
          id: newTplId, 
          amount: cleanTransaction.amount, 
          type: cleanTransaction.type, 
          categoryId: cleanTransaction.categoryId, 
          comment: cleanTransaction.comment, 
          dayOfMonth: new Date(cleanTransaction.date).getDate(), 
          isActive: true 
        });
      }

      if (targetId?.startsWith('virtual-')) {
        nextDeleted.push(targetId!);
        nextTx = [{ ...cleanTransaction, id: generateId(), templateId: currentTemplateId } as Transaction, ...nextTx];
      } else if (targetId && nextTx.some(i => i.id === targetId)) {
        nextTx = nextTx.map(i => i.id === targetId ? ({ ...cleanTransaction, id: targetId, templateId: currentTemplateId } as Transaction) : i);
      } else {
        nextTx = [{ ...cleanTransaction, id: generateId(), templateId: currentTemplateId } as Transaction, ...nextTx];
      }

      const nextAccounts = [...prev.accounts];
      nextAccounts[accIndex] = { ...acc, transactions: nextTx, recurringTemplates: nextTemplates, deletedVirtualIds: nextDeleted };
      return { ...prev, accounts: nextAccounts };
    });
    
    if (showAddModal) window.history.back();
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: string) => {
    setState(prev => {
      const accIndex = prev.accounts.findIndex(a => a.id === activeAccount.id);
      if (accIndex === -1) return prev;
      const acc = { ...prev.accounts[accIndex] };
      
      let templateIdToDelete: string | undefined;

      // Déterminer s'il y a un template lié
      if (id.startsWith('virtual-')) {
        templateIdToDelete = id.split('-')[1];
      } else {
        const tx = acc.transactions.find(t => t.id === id);
        if (tx?.templateId) templateIdToDelete = tx.templateId;
      }

      const nextAccounts = [...prev.accounts];
      nextAccounts[accIndex] = {
        ...acc,
        transactions: acc.transactions.filter(tx => tx.id !== id),
        // Si c'est une opération récurrente, on supprime carrément le template pour tous les mois
        recurringTemplates: templateIdToDelete 
          ? (acc.recurringTemplates || []).filter(tpl => tpl.id !== templateIdToDelete)
          : acc.recurringTemplates,
        deletedVirtualIds: id.startsWith('virtual-') 
          ? [...(acc.deletedVirtualIds || []), id] 
          : acc.deletedVirtualIds
      };
      return { ...prev, accounts: nextAccounts };
    });
  };

  const handleMonthChange = (offset: number) => {
    setSlideDirection(offset > 0 ? 'next' : 'prev');
    let nm = currentMonth + offset;
    let ny = currentYear;
    if (nm < 0) { nm = 11; ny -= 1; } else if (nm > 11) { nm = 0; ny += 1; }
    setCurrentMonth(nm);
    setCurrentYear(ny);
  };

  const handleReset = () => {
    if (window.confirm("🗑️ RÉINITIALISATION COMPLÈTE\n\nCette action effacera TOUT votre budget (comptes, transactions, flux fixes).\n\nContinuer ?")) {
      isResetting.current = true;
      try {
        window.localStorage.clear();
        window.localStorage.removeItem('zenbudget_state_v3');
        window.location.href = window.location.origin + window.location.pathname + "?reset=" + Date.now();
      } catch (e) { window.location.reload(); }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 safe-top shrink-0 z-50">
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
        <div className="h-full w-full">
          {activeView === 'DASHBOARD' && (
            <Dashboard 
              transactions={effectiveTransactions} categories={state.categories} activeAccount={activeAccount} allAccounts={state.accounts} 
              onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} month={currentMonth} year={currentYear} 
              onViewTransactions={() => navigateTo('TRANSACTIONS')} 
              checkingAccountBalance={getBalanceAtDate(now, true)} 
              availableBalance={availableBalance} 
              projectedBalance={projectedBalance} carryOver={carryOver} 
              onAddTransaction={handleUpsertTransaction}
            />
          )}
          {activeView === 'TRANSACTIONS' && (
            <TransactionList 
              transactions={effectiveTransactions} categories={state.categories} month={currentMonth} year={currentYear} 
              onDelete={handleDeleteTransaction}
              onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }} 
              onAddAtDate={(date) => { setModalInitialDate(date); setShowAddModal(true); }} 
              selectedDay={selectedDay} onSelectDay={setSelectedDay} totalBalance={projectedBalance} carryOver={carryOver} 
              cycleEndDay={activeAccount?.cycleEndDay || 0} onMonthChange={handleMonthChange} slideDirection={slideDirection} 
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
              onDeleteAccount={(id) => {
                setState(prev => {
                  const nextAccounts = prev.accounts.filter(a => a.id !== id);
                  if (nextAccounts.length === 0) return prev;
                  const nextActive = prev.activeAccountId === id ? nextAccounts[0].id : prev.activeAccountId;
                  return { ...prev, accounts: nextAccounts, activeAccountId: nextActive };
                });
              }} 
              onReset={handleReset} onLogout={() => {}} onShowWelcome={() => setShowWelcome(true)} 
              onBackup={() => {
                const dataStr = JSON.stringify(state);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                const link = document.createElement('a');
                link.setAttribute('href', dataUri);
                link.setAttribute('download', 'zenbudget_backup.backup');
                link.click();
              }} 
              onImport={(file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  try {
                    const json = JSON.parse(e.target?.result as string);
                    if(json.accounts) setState(json);
                  } catch(err) { alert("Fichier invalide."); }
                };
                reader.readAsText(file);
              }} 
            />
          )}
        </div>
      </main>

      <button onClick={() => { setEditingTransaction(null); setShowAddModal(true); }} className="fixed bottom-[100px] right-6 w-14 h-14 bg-slate-900 text-white rounded-[22px] shadow-2xl flex items-center justify-center z-40 border-4 border-white"><IconPlus className="w-7 h-7" /></button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 z-40">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => navigateTo('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => navigateTo('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => navigateTo('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
        <NavBtn active={activeView === 'SETTINGS'} icon={<IconSettings />} onClick={() => navigateTo('SETTINGS')} label="Réglages" />
      </nav>

      {showAddModal && <AddTransactionModal categories={state.categories} onClose={() => window.history.back()} onAdd={handleUpsertTransaction} initialDate={modalInitialDate} editItem={editingTransaction} />}
      
      {showWelcome && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => window.history.back()}>
          <div className="bg-white rounded-[40px] max-w-md w-full p-8 shadow-2xl space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center text-4xl">🌿</div>
            <h2 className="text-2xl font-black text-center italic text-slate-800">Guide Zen</h2>
            <div className="space-y-4 text-slate-600">
              <div className="flex gap-3"><span className="font-black text-indigo-600">0.</span><p className="text-sm font-medium">Ajoutez votre <b>solde bancaire actuel</b> comme un <b>Revenu</b> ponctuel aujourd'hui dans le <b>Journal</b>.</p></div>
              <div className="flex gap-3"><span className="font-black text-indigo-600">1.</span><p className="text-sm font-medium">Configurez vos <b>flux fixes</b> (loyer, abonnements...) dans l'onglet <b>"Fixes"</b>.</p></div>
              <div className="flex gap-3"><span className="font-black text-indigo-600">2.</span><p className="text-sm font-medium">Vérifiez votre <b>"Disponible Réel"</b> : c'est l'argent que vous pouvez dépenser sereinement.</p></div>
              <div className="flex gap-3"><span className="font-black text-indigo-600">3.</span><p className="text-sm font-medium leading-relaxed"><b>Sauvegarde vs CSV</b> : Utilisez l'<b>Export Backup</b> (Réglages) pour pouvoir restaurer votre budget. L'<b>Export CSV</b> est une simple lecture pour Excel.</p></div>
            </div>
            <button onClick={() => window.history.back()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all">C'est parti !</button>
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