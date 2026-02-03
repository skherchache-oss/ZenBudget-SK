import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, ViewType, Transaction, Category, BudgetAccount } from './types';
import { getInitialState, saveState } from './store';
import { MONTHS_FR } from './constants';
import { IconPlus, IconHome, IconCalendar, IconLogo, IconSettings } from './components/Icons';

import Dashboard from './components/Dashboard';
import RecurringManager from './components/RecurringManager';
import TransactionList from './components/TransactionList';
import AddTransactionModal from './components/AddTransactionModal';
import Settings from './components/Settings';

const views: ViewType[] = ['DASHBOARD', 'TRANSACTIONS', 'RECURRING', 'SETTINGS'];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => getInitialState());
  const [activeView, setActiveView] = useState<ViewType>('DASHBOARD');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const isInitialMount = useRef(true);

  // --- LOGIQUE DE BIENVENUE & AVIS ---
  useEffect(() => {
    const isFirstLaunch = !localStorage.getItem('zenbudget_launched');
    const hasRated = localStorage.getItem('zenbudget_has_rated');

    if (isFirstLaunch) {
      setShowWelcome(true);
      localStorage.setItem('zenbudget_launched', Date.now().toString());
    } else if (!hasRated) {
      // Affiche la demande d'avis après 3 jours ou quelques lancements
      const timer = setTimeout(() => setShowRatingModal(true), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Sauvegarde auto
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    saveState(state);
  }, [state]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const handleMonthChange = (offset: number) => {
    let nm = currentMonth + offset;
    let ny = currentYear;
    if (nm < 0) { nm = 11; ny -= 1; } else if (nm > 11) { nm = 0; ny += 1; }
    setCurrentMonth(nm);
    setCurrentYear(ny);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 safe-top shrink-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3"><IconLogo className="w-8 h-8" /><h1 className="text-xl font-black tracking-tighter italic">ZenBudget</h1></div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 flex-1 max-w-[180px] justify-between">
             <button onClick={() => handleMonthChange(-1)} className="p-2 text-slate-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg></button>
             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">{MONTHS_FR[currentMonth]} {currentYear}</span>
             <button onClick={() => handleMonthChange(1)} className="p-2 text-slate-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto px-4 pt-2">
        {activeView === 'DASHBOARD' && <Dashboard transactions={activeAccount.transactions} categories={state.categories} activeAccount={activeAccount} allAccounts={state.accounts} onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} month={currentMonth} year={currentYear} onViewTransactions={() => setActiveView('TRANSACTIONS')} checkingAccountBalance={activeAccount.balance} availableBalance={activeAccount.balance} projectedBalance={activeAccount.balance} carryOver={0} />}
        {activeView === 'TRANSACTIONS' && <TransactionList transactions={activeAccount.transactions} categories={state.categories} month={currentMonth} year={currentYear} onDelete={() => {}} onEdit={() => {}} onAddAtDate={() => {}} selectedDay={null} onSelectDay={() => {}} totalBalance={activeAccount.balance} carryOver={0} cycleEndDay={30} onMonthChange={handleMonthChange} slideDirection={null} />}
        {activeView === 'RECURRING' && <RecurringManager recurringTemplates={activeAccount.recurringTemplates || []} categories={state.categories} onUpdate={() => {}} totalBalance={activeAccount.balance} />}
        {activeView === 'SETTINGS' && <Settings state={state} onUpdateCategories={() => {}} onUpdateAccounts={(acc) => setState(prev => ({ ...prev, accounts: acc }))} onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} onReset={() => { localStorage.removeItem('zenbudget_data'); window.location.reload(); }} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-2 pb-8 px-6 z-40">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => setActiveView('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
        <NavBtn active={activeView === 'SETTINGS'} onClick={() => setActiveView('SETTINGS')} icon={<IconSettings />} label="Réglages" />
      </nav>

      {/* MODALE BIENVENUE */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[40px] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl animate-in zoom-in duration-300">
            <div className="text-5xl">🌿</div>
            <h2 className="text-2xl font-black text-slate-800">Bienvenue sur ZenBudget</h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Le secret de la sérénité financière est la clarté. Gérez vos comptes, suivez vos dépenses fixes et visualisez votre avenir.</p>
            <button onClick={() => setShowWelcome(false)} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all">Commencer mon voyage</button>
          </div>
        </div>
      )}

      {/* MODALE AVIS */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-500">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="text-4xl animate-bounce">✨</div>
              <h3 className="text-xl font-black text-slate-800">L'expérience vous plaît ?</h3>
              <p className="text-xs font-medium text-slate-500 px-4">Votre avis nous aide à faire grandir la communauté ZenBudget.</p>
              <div className="flex flex-col w-full gap-3 pt-4">
                <button onClick={() => { localStorage.setItem('zenbudget_has_rated', 'true'); setShowRatingModal(false); window.location.href="mailto:s.kherchache@gmail.com"; }} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest">Partager mon avis</button>
                <button onClick={() => { localStorage.setItem('zenbudget_has_rated', 'true'); setShowRatingModal(false); }} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest">Plus tard</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className="w-5 h-5">{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const container = document.getElementById('root');
if (container) { const root = createRoot(container); root.render(<App />); }
export default App;