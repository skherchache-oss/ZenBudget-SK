import React, { useState } from 'react';
import { AppState, Category, BudgetAccount } from '../types';
import { IconPlus } from './Icons';
import { createDefaultAccount } from '../store';

interface SettingsProps {
  state: AppState;
  onUpdateAccounts: (accounts: BudgetAccount[]) => void;
  onSetActiveAccount: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onReset: () => void;
  onLogout: () => void;
  onUpdateCategories: (cats: Category[]) => void;
  onUpdateBudget: (val: number) => void;
}

const Settings: React.FC<SettingsProps> = ({ state, onUpdateAccounts, onSetActiveAccount, onDeleteAccount, onReset }) => {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId);

  const createAccount = () => {
    if (!newAccName.trim() || !state.user) return;
    const newAcc = createDefaultAccount(state.user.id);
    newAcc.name = newAccName.trim();
    onUpdateAccounts([...state.accounts, newAcc]);
    onSetActiveAccount(newAcc.id);
    setNewAccName('');
    setIsAddingAccount(false);
  };

  const startEditing = (acc: BudgetAccount) => {
    setEditingAccountId(acc.id);
    setEditName(acc.name);
  };

  const saveEdit = () => {
    if (!editingAccountId || !editName.trim()) {
      setEditingAccountId(null);
      return;
    }
    const nextAccounts = state.accounts.map(a => 
      a.id === editingAccountId ? { ...a, name: editName.trim() } : a
    );
    onUpdateAccounts(nextAccounts);
    setEditingAccountId(null);
  };

  const updateCycleDay = (day: number) => {
    if (!activeAccount) return;
    const nextAccounts = state.accounts.map(a => 
      a.id === activeAccount.id ? { ...a, cycleEndDay: day } : a
    );
    onUpdateAccounts(nextAccounts);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation(); 
    if (state.accounts.length <= 1) return;
    if (window.confirm("🗑 SUPPRIMER CE COMPTE ?\n\nAttention : toutes les données associées seront effacées.")) {
      onDeleteAccount(id);
    }
  };

  const handleFeedback = () => {
    const subject = encodeURIComponent("Feedback ZenBudget 🚀");
    const body = encodeURIComponent(`Bonjour !\n\nVoici mon retour sur ZenBudget...\n\nVersion: 4.2`);
    window.location.href = `mailto:s.kherchache@gmail.com?subject=${subject}&body=${body}`;
  };

  // STYLE HARMONISÉ POUR TOUS LES TITRES
  const sectionTitleStyle = "text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2";

  return (
    <div className="space-y-8 pb-32 overflow-y-auto no-scrollbar h-full px-1 fade-in">
      {/* SECTION MON ESPACE */}
      <section className="mt-4">
        <h2 className={sectionTitleStyle}><span>✨</span> Mon Espace</h2>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-xl">🧘‍♂️</div>
            <div>
              <h3 className="font-black text-gray-900 leading-none mb-1 text-[15px]">Utilisateur Zen</h3>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Stockage local & Sécurisé</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION AIDE & LEXIQUE */}
      <section>
        <h2 className={sectionTitleStyle}><span>📖</span> Aide & Lexique</h2>
        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
          <button 
            onClick={() => setIsHowItWorksOpen(!isHowItWorksOpen)}
            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">✨</span>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Comment ça marche ?</h3>
            </div>
            <svg className={`w-4 h-4 text-slate-300 transition-transform ${isHowItWorksOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
          </button>

          <div className={`transition-all duration-500 ease-in-out ${isHowItWorksOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="px-6 pb-6 space-y-4">
              <div className="bg-indigo-50 p-5 rounded-[24px] border border-indigo-100">
                <p className="text-[11px] text-indigo-800/80 leading-relaxed font-medium">
                  ZenBudget calcule votre <span className="font-bold underline">Disponible Réel</span> pour que vous sachiez ce qu'il reste après vos factures fixes.
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Disponible Réel</span>
                <p className="text-[10px] text-slate-400">Solde banque actuel moins les factures fixes restant à payer.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION CYCLE BUDGÉTAIRE */}
      <section>
        <h2 className={sectionTitleStyle}><span>📅</span> Cycle Budgétaire</h2>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {[0, 24, 25, 26, 28].map((day) => (
              <button
                key={day}
                onClick={() => updateCycleDay(day)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                  (activeAccount?.cycleEndDay || 0) === day 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' 
                  : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                }`}
              >
                {day === 0 ? 'Fin de mois' : `Le ${day}`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION MES COMPTES */}
      <section>
        <h2 className={sectionTitleStyle}><span>💳</span> Mes Comptes</h2>
        <div className="space-y-3">
          {state.accounts.map(acc => (
            <div 
              key={acc.id} 
              className={`bg-white p-4 rounded-3xl border transition-all ${state.activeAccountId === acc.id ? 'border-indigo-200 shadow-md ring-4 ring-indigo-50/50' : 'border-gray-100 opacity-80'}`}
              onClick={() => state.activeAccountId !== acc.id && onSetActiveAccount(acc.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                  <span className="font-bold text-sm text-gray-800">{acc.name}</span>
                </div>
                <button onClick={(e) => handleDelete(e, acc.id)} className="p-2 text-red-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
              </div>
            </div>
          ))}
          <button onClick={() => setIsAddingAccount(true)} className="w-full py-4 border-2 border-dashed border-gray-100 text-gray-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-3xl bg-white/50">
            <IconPlus className="w-4 h-4" /> Nouveau compte
          </button>
        </div>
      </section>

      {/* SECTION FEEDBACK */}
      <section>
        <h2 className={sectionTitleStyle}><span>🚀</span> Partager une idée</h2>
        <button onClick={handleFeedback} className="w-full py-6 bg-indigo-600 text-white font-black rounded-[32px] shadow-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">
          Envoyer un retour par mail
        </button>
      </section>

      <section className="pt-4">
        <button onClick={onReset} className="w-full py-4 bg-red-50 text-red-500 font-black rounded-2xl border border-red-100 uppercase text-[10px] tracking-widest">
          Effacer toutes les données
        </button>
      </section>

      <p className="text-center text-[8px] text-gray-300 font-black uppercase tracking-[0.3em] py-8">Version 4.2 • Vercel Optimized</p>
    </div>
  );
};

export default Settings;