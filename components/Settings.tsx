
import React, { useState, useEffect } from 'react';
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

const AccountItem: React.FC<{
  acc: BudgetAccount;
  isActive: boolean;
  onDelete: (id: string) => void;
  onRename: (acc: BudgetAccount) => void;
  onSelect: (id: string) => void;
  canDelete: boolean;
}> = ({ acc, isActive, onDelete, onRename, onSelect, canDelete }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      setTimeout(() => setIsConfirmingDelete(false), 3000);
      return;
    }
    onDelete(acc.id);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRename(acc);
  };

  return (
    <div 
      className={`flex items-center justify-between bg-white rounded-[24px] p-4 mb-2 border transition-all cursor-pointer ${isActive ? 'border-indigo-100 shadow-sm ring-4 ring-indigo-50/20' : 'border-slate-50 hover:border-slate-200'}`}
      onClick={() => onSelect(acc.id)}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: `${acc.color}20`, border: `1px solid ${acc.color}40` }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[12px] font-black text-slate-800 truncate uppercase tracking-tight">{acc.name}</span>
          {isActive && <span className="text-[7px] font-black text-indigo-500 uppercase tracking-widest">Actif</span>}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={handleRename} className="p-2 text-slate-300 hover:text-indigo-600 transition-all rounded-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        {canDelete && (
          <button 
            onClick={handleDelete} 
            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all min-w-[40px] ${isConfirmingDelete ? 'bg-red-600 text-white' : 'text-red-300 hover:bg-red-50'}`}
          >
            {isConfirmingDelete ? 'Sûr ?' : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
          </button>
        )}
      </div>
    </div>
  );
};

const Settings: React.FC<SettingsProps> = ({ state, onUpdateAccounts, onSetActiveAccount, onDeleteAccount, onReset }) => {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [customDay, setCustomDay] = useState('');

  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId);
  
  const SectionTitle: React.FC<{ icon: string, title: string }> = ({ icon, title }) => (
    <div className="flex items-center gap-3 px-2 mb-3">
      <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-base border border-slate-50 shrink-0">
        {icon}
      </div>
      <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h2>
    </div>
  );

  useEffect(() => {
    const day = activeAccount?.cycleEndDay;
    if (day && day > 0 && ![25, 26, 28].includes(day)) {
      setCustomDay(day.toString());
    } else {
      setCustomDay('');
    }
  }, [activeAccount?.id, activeAccount?.cycleEndDay]);

  const handleCreateAccount = () => {
    if (!newAccName.trim()) return;
    const newAcc = createDefaultAccount(state.user?.id || 'local-user');
    newAcc.name = newAccName.trim();
    onUpdateAccounts([...state.accounts, newAcc]);
    onSetActiveAccount(newAcc.id);
    setNewAccName('');
    setIsAddingAccount(false);
  };

  const handleStartRename = (acc: BudgetAccount) => {
    setEditingAccountId(acc.id);
    setEditName(acc.name);
  };

  const handleSaveRename = () => {
    if (!editingAccountId || !editName.trim()) {
      setEditingAccountId(null);
      return;
    }
    const nextAccounts = state.accounts.map(a => a.id === editingAccountId ? { ...a, name: editName.trim() } : a);
    onUpdateAccounts(nextAccounts);
    setEditingAccountId(null);
  };

  const updateCycleDay = (day: number) => {
    if (!activeAccount) return;
    const nextAccounts = state.accounts.map(a => a.id === activeAccount.id ? { ...a, cycleEndDay: day } : a);
    onUpdateAccounts(nextAccounts);
  };

  const handleCustomDayChange = (val: string) => {
    const s = val.replace(/[^0-9]/g, '').slice(0, 2);
    setCustomDay(s);
    const day = parseInt(s);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      updateCycleDay(day);
    }
  };

  const handleFeedback = () => {
    const subject = encodeURIComponent("Suggestion ZenBudget 🚀");
    const body = encodeURIComponent("Bonjour,\n\nJ'ai une idée ou un bug à signaler pour ZenBudget : ");
    window.location.href = `mailto:s.kherchache@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-7 pb-32 overflow-y-auto no-scrollbar h-full px-1 fade-in">
      {/* MON ESPACE */}
      <section className="mt-4">
        <SectionTitle icon="✨" title="Mon Espace" />
        <div className="bg-white p-5 rounded-[28px] border border-slate-50 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl shadow-inner">🧘‍♂️</div>
            <div>
              <h3 className="font-black text-slate-800 text-sm leading-none mb-1">Utilisateur Zen</h3>
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Stockage local sécurisé</p>
            </div>
          </div>
        </div>
      </section>

      {/* ZENBUDGET : GESTION INTUITIVE */}
      <section>
        <SectionTitle icon="📖" title="Gestion intuitive" />
        <div className="bg-white rounded-[28px] border border-slate-50 overflow-hidden shadow-sm">
          <button onClick={() => setIsHowItWorksOpen(!isHowItWorksOpen)} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Comment ça marche ?</h3>
            <svg className={`w-3.5 h-3.5 text-slate-300 transition-transform ${isHowItWorksOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`transition-all duration-300 ${isHowItWorksOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="px-5 pb-5 space-y-6">
              <div className="bg-slate-50 p-5 rounded-2xl space-y-5">
                <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic">
                  ZenBudget est une méthode de gestion financière basée sur la sérénité. Elle ne se contente pas de lister vos transactions, elle calcule votre véritable capacité de dépense sans stress.
                </p>

                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase text-indigo-600 tracking-wider">Le cycle Zen</h4>
                  <div className="space-y-3 text-[11px] text-slate-500 font-medium leading-relaxed">
                    <p><b>1. Revenus :</b> Enregistrez vos rentrées (Salaires, aides...).</p>
                    <p><b>2. Fixes :</b> ZenBudget déduit vos charges programmées dès le début du cycle, même si elles n'ont pas encore été payées.</p>
                    <p><b>3. Variables :</b> Vos dépenses quotidiennes ajustent votre solde projeté en temps réel.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MES COMPTES */}
      <section>
        <SectionTitle icon="💳" title="Mes Comptes" />
        <div className="space-y-1">
          {state.accounts.map(acc => (
            <AccountItem key={acc.id} acc={acc} isActive={state.activeAccountId === acc.id} onDelete={onDeleteAccount} onRename={handleStartRename} onSelect={onSetActiveAccount} canDelete={state.accounts.length > 1} />
          ))}
          {editingAccountId && (
            <div className="bg-white p-4 rounded-[22px] border-2 border-indigo-200 mb-2 animate-in zoom-in-95">
              <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nom..." className="w-full bg-slate-50 p-3 rounded-xl mb-3 text-sm font-bold border-none outline-none focus:ring-1 focus:ring-indigo-200" />
              <div className="flex gap-2">
                <button onClick={() => setEditingAccountId(null)} className="flex-1 py-2 text-[10px] font-black uppercase text-slate-400">Annuler</button>
                <button onClick={handleSaveRename} className="flex-1 py-2 text-[10px] font-black uppercase text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">Sauver</button>
              </div>
            </div>
          )}
          {isAddingAccount ? (
            <div className="bg-white p-4 rounded-[22px] border-2 border-indigo-200 mb-2 animate-in zoom-in-95">
              <input autoFocus value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Nom..." className="w-full bg-slate-50 p-3 rounded-xl mb-3 text-sm font-bold border-none outline-none focus:ring-1 focus:ring-indigo-200" />
              <div className="flex gap-2">
                <button onClick={() => setIsAddingAccount(false)} className="flex-1 py-2 text-[10px] font-black uppercase text-slate-400">Annuler</button>
                <button onClick={handleCreateAccount} className="flex-1 py-2 text-[10px] font-black uppercase text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">Créer</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAddingAccount(true)} className="w-full py-4 border-2 border-dashed border-slate-100 text-slate-400 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-[24px] bg-white/40 hover:bg-white hover:text-indigo-600 transition-all">
              <IconPlus className="w-4 h-4" /> Nouveau compte
            </button>
          )}
        </div>
      </section>

      {/* CYCLE BUDGÉTAIRE */}
      <section>
        <SectionTitle icon="📅" title="Cycle Budgétaire" />
        <div className="bg-white p-5 rounded-[28px] border border-slate-50 shadow-sm space-y-4">
          <p className="text-[10px] text-slate-400 font-medium leading-tight px-1">Jour du salaire (le budget redémarre à cette date).</p>
          <div className="flex flex-wrap items-center gap-2">
            {[0, 25, 26, 28].map(day => (
              <button key={day} onClick={() => updateCycleDay(day)} className={`w-11 h-11 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border-2 ${activeAccount?.cycleEndDay === day ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}>
                {day === 0 ? 'Fin' : `${day}`}
              </button>
            ))}
            <div className="relative">
              <input 
                type="number" inputMode="numeric" value={customDay} onChange={(e) => handleCustomDayChange(e.target.value)} placeholder="+"
                className={`w-11 h-11 text-center rounded-xl text-[11px] font-black outline-none border-2 transition-all ${customDay && ![25, 26, 28].includes(parseInt(customDay)) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-dashed border-slate-200 text-slate-500'}`}
              />
            </div>
            {customDay && ![25, 26, 28].includes(parseInt(customDay)) && (
              <span className="text-[9px] font-black text-indigo-500 uppercase ml-1 animate-in slide-in-from-left">Le {customDay}</span>
            )}
          </div>
        </div>
      </section>

      {/* ACTIONS FINALES & FEEDBACK */}
      <section className="space-y-4">
        <div className="bg-indigo-50/40 border border-indigo-100 p-7 rounded-[36px] text-center space-y-5 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-20 h-20 bg-indigo-100/30 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
          <p className="text-[12px] font-medium text-slate-600 leading-relaxed italic relative z-10">
            "ZenBudget évolue grâce à vous ! Si vous avez envie d'aider à améliorer l'appli, envoyez-nous une suggestion ou signalez un bug."
          </p>
          <button 
            onClick={handleFeedback} 
            className="w-full py-4.5 bg-slate-900 text-white font-black rounded-[24px] uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2 relative z-10 hover:bg-slate-800"
          >
            <span>Envoyez un retour</span>
            <span className="text-sm">✨</span>
          </button>
        </div>

        <button 
          onClick={onReset} 
          className="w-full py-4 text-red-300 font-black rounded-[24px] uppercase text-[9px] tracking-[0.2em] active:scale-95 transition-all hover:bg-red-50"
        >
          Réinitialiser l'application
        </button>
      </section>

      <div className="pt-4 border-t border-slate-50 text-center">
        <p className="text-[8px] text-slate-200 font-black uppercase tracking-[0.4em]">ZenBudget V4.7 • Premium Design</p>
      </div>
    </div>
  );
};

export default Settings;
