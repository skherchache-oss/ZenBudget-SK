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

const views: ViewType[] = ['DASHBOARD', 'TRANSACTIONS', 'RECURRING', 'SETTINGS'];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => getInitialState());
  const [activeView, setActiveView] = useState<ViewType>('DASHBOARD');
  
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<string>(new Date().toISOString());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  const isInitialMount = useRef(true);
  
  // --- LOGIQUE DE SWIPE (Balayage) ---
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isSignificant = Math.abs(distance) > 70; // Seuil de 70px pour éviter les déclenchements accidentels
    
    if (isSignificant) {
      const currentIndex = views.indexOf(activeView);
      if (distance > 0 && currentIndex < views.length - 1) {
        // Swipe vers la GAUCHE -> Onglet suivant
        setActiveView(views[currentIndex + 1]);
      } else if (distance < 0 && currentIndex > 0) {
        // Swipe vers la DROITE -> Onglet précédent
        setActiveView(views[currentIndex - 1]);
      }
    }
    
    // Reset
    touchStartX.current = null;
    touchEndX.current = null;
  };

  useEffect(() => {
    const firstLaunch = localStorage.getItem('zenbudget_first_launch');
    const hasRated = localStorage.getItem('zenbudget_has_rated');
    
    if (!firstLaunch) {
      localStorage.setItem('zenbudget_first_launch', Date.now().toString());
    } else if (!hasRated) {
      const diffDays = (Date.now() - parseInt(firstLaunch)) / (1000 * 3600 * 24);
      if (diffDays > 3) {
        const timer = setTimeout(() => setShowRatingModal(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

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

  const handleMonthChange = (offset: number) => {
    setSlideDirection(offset > 0 ? 'next' : 'prev');
    let nm = currentMonth + offset;
    let ny = currentYear;
    if (nm < 0) { nm = 11; ny -= 1; } else if (nm > 11) { nm = 0; ny += 1; }
    setCurrentMonth(nm);
    setCurrentYear(ny);
  };

  const handleUpsertTransaction = (t: any) => { /* Ta logique upsert */ };

  return (
    <div 
      className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 safe-top shrink-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3"><IconLogo className="w-8 h-8" /><h1 className="text-xl font-black tracking-tighter text-slate-900 italic">ZenBudget</h1></div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm flex-1 max-w-[180px] justify-between">
             <button onClick={(e) => { e.stopPropagation(); handleMonthChange(-1); }} className="p-2 text-slate-400 active:scale-90"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg></button>
             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">{MONTHS_FR[currentMonth]} {currentYear}</span>
             <button onClick={(e) => { e.stopPropagation(); handleMonthChange(1); }} className="p-2 text-slate-400 active:scale-90"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto px-4 pt-2">
        <div className="h-full w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeView === 'DASHBOARD' && <Dashboard transactions={[]} categories={state.categories} activeAccount={activeAccount} allAccounts={state.accounts} onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} month={currentMonth} year={currentYear} onViewTransactions={() => setActiveView('TRANSACTIONS')} checkingAccountBalance={0} availableBalance={0} projectedBalance={0} carryOver={0} />}
          {activeView === 'TRANSACTIONS' && <TransactionList transactions={[]} categories={state.categories} month={currentMonth} year={currentYear} onDelete={() => {}} onEdit={() => {}} onAddAtDate={() => {}} selectedDay={selectedDay} onSelectDay={setSelectedDay} totalBalance={0} carryOver={0} cycleEndDay={activeAccount?.cycleEndDay || 0} onMonthChange={handleMonthChange} slideDirection={slideDirection} />}
          {activeView === 'RECURRING' && <RecurringManager recurringTemplates={activeAccount?.recurringTemplates || []} categories={state.categories} onUpdate={() => {}} totalBalance={0} />}
          {activeView === 'SETTINGS' && <Settings state={state} onUpdateCategories={() => {}} onUpdateBudget={() => {}} onUpdateAccounts={(accounts) => setState(prev => ({ ...prev, accounts }))} onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} onDeleteAccount={(id) => {}} onReset={() => {}} onLogout={() => {}} />}
        </div>
      </main>

      <button onClick={() => setShowAddModal(true)} className="fixed bottom-[100px] right-6 w-14 h-14 bg-slate-900 text-white rounded-[22px] shadow-2xl flex items-center justify-center active:scale-90 z-40 border-4 border-white"><IconPlus className="w-7 h-7" /></button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 z-40">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => setActiveView('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
        <NavBtn active={activeView === 'SETTINGS'} onClick={() => setActiveView('SETTINGS')} icon={<IconSettings />} label="Réglages" />
      </nav>

      {showAddModal && <AddTransactionModal categories={state.categories} onClose={() => setShowAddModal(false)} onAdd={handleUpsertTransaction} initialDate={modalInitialDate} />}
      
      {showRatingModal && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[40px] shadow-2xl p-8 relative animate-in slide-in-from-bottom duration-500 pb-[calc(2rem+95px)]">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center text-3xl animate-bounce">✨</div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Vivez-vous l'expérience Zen ?</h3>
              <p className="text-[12px] font-medium text-slate-500 leading-relaxed px-4">
                Si vous appréciez la sérénité de ZenBudget, votre retour nous ferait chaud au cœur !
              </p>
              <div className="flex flex-col w-full gap-3 pt-4">
                <button 
                  onClick={() => { 
                    localStorage.setItem('zenbudget_has_rated', 'true'); 
                    setShowRatingModal(false); 
                    window.location.href = `mailto:s.kherchache@gmail.com?subject=Avis ZenBudget&body=Bonjour !`; 
                  }}
                  className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl active:scale-95 text-[11px] uppercase tracking-widest"
                >
                  Partager mon avis
                </button>
                <button 
                  onClick={() => { localStorage.setItem('zenbudget_has_rated', 'true'); setShowRatingModal(false); }}
                  className="w-full py-4 bg-white border border-slate-100 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest"
                >
                  Plus tard
                </button>
              </div>
            </div>
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