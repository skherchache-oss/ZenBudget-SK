import React, { useState } from 'react';
import { AppState, BudgetAccount } from '../types';
import { IconPlus } from './Icons';
import { createDefaultAccount } from '../store';

interface SettingsProps {
  state: AppState;
  onUpdateAccounts: (accounts: BudgetAccount[]) => void;
  onSetActiveAccount: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onReset: () => void;
  onUpdateCategories: (cats: any) => void;
  onUpdateBudget: (val: number) => void;
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ state, onUpdateAccounts, onSetActiveAccount, onDeleteAccount, onReset }) => {
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId);

  const sectionTitleStyle = "text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2";

  const updateCycleDay = (day: number) => {
    if (!activeAccount) return;
    const nextAccounts = state.accounts.map(a => 
      a.id === activeAccount.id ? { ...a, cycleEndDay: day } : a
    );
    onUpdateAccounts(nextAccounts);
  };

  const handleFeedback = () => {
    window.location.href = `mailto:s.kherchache@gmail.com?subject=Feedback ZenBudget&body=Bonjour, j'ai une idée pour l'appli !`;
  };

  return (
    <div className="space-y-8 pb-32 overflow-y-auto no-scrollbar h-full px-1 fade-in">
      {/* MON ESPACE */}
      <section className="mt-4">
        <h2 className={sectionTitleStyle}><span>✨</span> Mon Espace</h2>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-xl">🧘‍♂️</div>
            <div>
              <h3 className="font-black text-gray-900 text-[15px] leading-none mb-1">Utilisateur Zen</h3>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Stockage local & Sécurisé</p>
            </div>
          </div>
        </div>
      </section>

      {/* AIDE & LEXIQUE */}
      <section>
        <h2 className={sectionTitleStyle}><span>📖</span> Aide & Lexique</h2>
        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
          <button onClick={() => setIsHowItWorksOpen(!isHowItWorksOpen)} className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-xl">✨</span>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Comment ça marche ?</h3>
            </div>
            <svg className={`w-4 h-4 text-slate-300 transition-transform ${isHowItWorksOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
          </button>

          <div className={`transition-all duration-500 ${isHowItWorksOpen ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="px-6 pb-6 space-y-6">
              <div className="bg-indigo-50 p-5 rounded-[24px] border border-indigo-100">
                <h4 className="text-[12px] font-black text-indigo-900 mb-3 uppercase">ZenBudget : Gestion intuitive</h4>
                <p className="text-[11px] text-indigo-800/80 leading-relaxed font-medium mb-4">Simplifiez vos finances en 3 étapes :</p>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-[10px] font-bold text-indigo-900/70">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] shrink-0">1</span>
                    Notez vos revenus et dépenses quotidiens dans le Journal.
                  </li>
                  <li className="flex gap-3 text-[10px] font-bold text-indigo-900/70">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] shrink-0">2</span>
                    Gérez vos "Fixes" (loyer, netflix) pour qu'ils soient déduits automatiquement.
                  </li>
                  <li className="flex gap-3 text-[10px] font-bold text-indigo-900/70">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] shrink-0">3</span>
                    Visez votre "Disponible Réel" pour dépenser sans stress.
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lexique des Stats</h4>
                <div className="space-y-3">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <span className="text-[9px] font-black text-indigo-600 uppercase block mb-1">Disponible Réel</span>
                    <p className="text-[10px] text-slate-500 italic">"L'indicateur de sérénité"</p>
                    <p className="text-[10px] text-slate-400 mt-1">Solde bancaire moins les charges fixes à venir d'ici votre prochain salaire.</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <span className="text-[9px] font-black text-indigo-600 uppercase block mb-1">Solde Bancaire</span>
                    <p className="text-[10px] text-slate-500">Calcul exact de toutes vos opérations saisies.</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <span className="text-[9px] font-black text-indigo-600 uppercase block mb-1">Fin de mois</span>
                    <p className="text-[10px] text-slate-500">Projection de votre solde la veille du prochain cycle.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CYCLE BUDGÉTAIRE */}
      <section>
        <h2 className={sectionTitleStyle}><span>📅</span> Cycle Budgétaire</h2>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
          <p className="text-[11px] text-gray-500 font-medium leading-relaxed mb-4">Définissez le jour où votre budget redémarre (jour du salaire).</p>
          <div className="flex flex-wrap gap-2">
            {[0, 24, 25, 26, 28].map(day => (
              <button key={day} onClick={() => updateCycleDay(day)} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${activeAccount?.cycleEndDay === day ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}>
                {day === 0 ? 'Fin de mois' : `Le ${day}`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FEEDBACK */}
      <section>
        <h2 className={sectionTitleStyle}><span>🚀</span> Partager une idée</h2>
        <div className="bg-indigo-600 p-8 rounded-[40px] shadow-xl relative overflow-hidden text-center">
          <div className="relative z-10">
            <h3 className="text-white font-black text-lg mb-2">ZenBudget évolue grâce à vous ! ✨</h3>
            <p className="text-indigo-100 text-[11px] mb-6 font-medium leading-relaxed">Si vous avez envie d'aider à améliorer l'appli, envoyez-nous une suggestion ou signalez un bug.</p>
            <button onClick={handleFeedback} className="w-full py-4 bg-white text-indigo-600 font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Envoyer un retour</button>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        </div>
      </section>

      <section className="pt-4">
        <button onClick={onReset} className="w-full py-4 bg-red-50 text-red-500 font-black rounded-2xl border border-red-100 uppercase text-[10px] tracking-widest active:scale-95 transition-all">Effacer toutes les données</button>
      </section>

      <div className="pt-8 border-t border-gray-100">
        <p className="text-center text-[8px] text-gray-300 font-black uppercase tracking-[0.3em]">Version 4.3 • Vercel Optimized</p>
      </div>
    </div>
  );
};

export default Settings;