import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, ViewType, BudgetAccount } from './types';
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
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const isInitialMount = useRef(true);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    const isFirstLaunch = !localStorage.getItem('zenbudget_launched');
    if (isFirstLaunch) {
      setShowWelcome(true);
      localStorage.setItem('zenbudget_launched', Date.now().toString());
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    saveState(state);
  }, [state]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.targetTouches[0].clientX; };
  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) > 70) {
      const currentIndex = views.indexOf(activeView);
      if (distance > 0 && currentIndex < views.length - 1) setActiveView(views[currentIndex + 1]);
      else if (distance < 0 && currentIndex > 0) setActiveView(views[currentIndex - 1]);
    }
    touchStartX.current = null; touchEndX.current = null;
  };

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const filteredTransactions = useMemo(() => {
    return activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [activeAccount, currentMonth, currentYear]);

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] overflow-hidden font-sans" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 safe-top shrink-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3"><IconLogo className="w-8 h-8" /><h1 className="text-xl font-black tracking-tighter italic text-slate-900">ZenBudget</h1></div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 flex-1 max-w-[180px] justify-between">
             <button onClick={() => { let nm = currentMonth - 1; let ny = currentYear; if (nm < 0) { nm = 11; ny -= 1; } setCurrentMonth(nm); setCurrentYear(ny); }} className="p-2 text-slate-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg></button>
             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">{MONTHS_FR[currentMonth]} {currentYear}</span>
             <button onClick={() => { let nm = currentMonth + 1; let ny = currentYear; if (nm > 11) { nm = 0; ny += 1; } setCurrentMonth(nm); setCurrentYear(ny); }} className="p-2 text-slate-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto px-4 pt-2">
        {activeView === 'DASHBOARD' && <Dashboard transactions={filteredTransactions} categories={state.categories} activeAccount={activeAccount} allAccounts={state.accounts} onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} month={currentMonth} year={currentYear} onViewTransactions={() => setActiveView('TRANSACTIONS')} checkingAccountBalance={activeAccount.balance} availableBalance={activeAccount.balance} projectedBalance={activeAccount.balance} carryOver={0} />}
        {activeView === 'TRANSACTIONS' && <TransactionList transactions={filteredTransactions} categories={state.categories} month={currentMonth} year={currentYear} onDelete={() => {}} onEdit={() => {}} onAddAtDate={() => {}} selectedDay={null} onSelectDay={() => {}} totalBalance={activeAccount.balance} carryOver={0} cycleEndDay={30} onMonthChange={() => {}} slideDirection={null} />}
        {activeView === 'RECURRING' && <RecurringManager recurringTemplates={activeAccount.recurringTemplates || []} categories={state.categories} onUpdate={() => {}} totalBalance={activeAccount.balance} />}
        {activeView === 'SETTINGS' && <Settings state={state} onUpdateAccounts={(acc) => setState(prev => ({ ...prev, accounts: acc }))} onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} onReset={() => { localStorage.removeItem('zenbudget_data'); window.location.reload(); }} onShowWelcome={() => setShowWelcome(true)} onShowRating={() => setShowRatingModal(true)} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center pt-2 pb-8 px-6 z-40">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => setActiveView('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
        <NavBtn active={activeView === 'SETTINGS'} onClick={() => setActiveView('SETTINGS')} icon={<IconSettings />} label="Réglages" />
      </nav>

      {/* MODALE GUIDE COMPLET AVEC INITIALISATION SOLDE */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowWelcome(false)}>
          <div className="bg-white rounded-[40px] p-8 max-w-sm w-full space-y-7 shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="text-4xl mb-4">🌿</div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Le Parcours Zen</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Démarrage & Sérénité</p>
            </div>

            <div className="space-y-5">
              {/* ÉTAPE CRUCIALE : INITIALISATION */}
              <div className="flex gap-4 p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black shrink-0 shadow-sm">0</div>
                <div>
                  <h4 className="text-[11px] font-black uppercase text-indigo-700">Initialisation</h4>
                  <p className="text-[10px] text-indigo-900 leading-relaxed font-bold">Pour démarrer, allez dans le <strong>Journal</strong> et ajoutez votre <strong>solde bancaire réel</strong> à la date d'aujourd'hui (Type: Revenu).</p>
                </div>
              </div>

              <div className="flex gap-4 px-3">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black shrink-0">1</div>
                <div>
                  <h4 className="text-[11px] font-black uppercase text-slate-800">Prévoyez vos Fixes</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Ajoutez vos loyers et abonnements dans l'onglet <strong>Fixes</strong>. Ils s'appliquent tout seuls chaque mois.</p>
                </div>
              </div>

              <div className="flex gap-4 px-3">
                <div className="w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center font-black shrink-0">2</div>
                <div>
                  <h4 className="text-[11px] font-black uppercase text-slate-800">Notez le quotidien</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Utilisez le <strong>Journal</strong> pour vos courses ou sorties. Votre reste à vivre s'actualise instantanément.</p>
                </div>
              </div>

              <div className="flex gap-4 px-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black shrink-0">3</div>
                <div>
                  <h4 className="text-[11px] font-black uppercase text-slate-800">Respirez</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Consultez vos <strong>Stats</strong> pour voir où part votre argent et ajuster sans stress.</p>
                </div>
              </div>
            </div>

            {isMobile && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                <div className="text-xl">↔️</div>
                <p className="text-[10px] font-bold text-slate-400 italic">Astuce : Glissez l'écran vers la gauche ou la droite pour changer d'onglet.</p>
              </div>
            )}

            <button onClick={() => setShowWelcome(false)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl">Compris !</button>
          </div>
        </div>
      )}

      {showRatingModal && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowRatingModal(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-500" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="text-4xl animate-bounce">✨</div>
              <h3 className="text-xl font-black text-slate-800">Partagez la sérénité</h3>
              <p className="text-xs font-medium text-slate-500 px-4">Votre avis nous aide énormément !</p>
              <div className="flex flex-col w-full gap-3 pt-4">
                <button onClick={() => { localStorage.setItem('zenbudget_has_rated', 'true'); setShowRatingModal(false); window.location.href="mailto:s.kherchache@gmail.com?subject=Avis ZenBudget ✨&body=Voici mon retour :"; }} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest">Donner mon avis</button>
                <button onClick={() => setShowRatingModal(false)} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest">Plus tard</button>
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
if (container) { const root = createRoot(container); root.render(<App />); }
export default App;