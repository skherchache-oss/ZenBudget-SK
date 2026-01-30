
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
    e.preventDefault();
    e.stopPropagation(); 
    
    if (state.accounts.length <= 1) {
      alert("Impossible de supprimer le dernier compte.");
      return;
    }
    
    const confirmMessage = "🗑 SUPPRIMER CE COMPTE ?\n\nAttention : toutes les transactions et charges fixes associées à ce compte seront définitivement effacées.";
    if (window.confirm(confirmMessage)) {
      onDeleteAccount(id);
    }
  };

  const handleFeedback = () => {
    const subject = encodeURIComponent("Feedback ZenBudget-SK");
    const body = encodeURIComponent(
      `Bonjour !\n\nVoici mon retour sur l'application ZenBudget :\n\n[Écrivez votre message ici]\n\n---\nInfos techniques :\nDate: ${new Date().toLocaleDateString()}\nVersion: 3.9`
    );
    window.location.href = `mailto:s.kherchache@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header Statut */}
      <section className="bg-white p-6 rounded-[32px] border border-gray-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-xl">
            🧘‍♂️
          </div>
          <div>
            <h3 className="font-black text-gray-900 leading-none mb-1 text-[15px]">Espace Zen</h3>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Stockage local & Sécurisé</p>
          </div>
        </div>
      </section>

      {/* Aide & Lexique dépliable */}
      <section className="bg-white rounded-[32px] border border-slate-100 overflow-hidden transition-all duration-300 shadow-sm">
        <button 
          onClick={() => setIsHowItWorksOpen(!isHowItWorksOpen)}
          className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-slate-800">
            <span className="text-xl">✨</span>
            <h2 className="text-[11px] font-black uppercase tracking-[0.15em]">Comment ça marche ?</h2>
          </div>
          <svg className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${isHowItWorksOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
        </button>

        <div className={`transition-all duration-500 ease-in-out ${isHowItWorksOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <div className="px-6 pb-6 space-y-6">
            <div className="space-y-4">
              <div className="bg-indigo-50 p-5 rounded-[24px] border border-indigo-100">
                <h3 className="text-[12px] font-black text-indigo-900 mb-2">Gestion de budget intuitive</h3>
                <p className="text-[11px] text-indigo-800/80 leading-relaxed font-medium">
                  ZenBudget est conçu pour vous offrir une vision claire de vos finances <span className="font-bold">sans la complexité des tableaux Excel</span>. Tout est pensé pour être rapide, mobile et visuel.
                </p>
              </div>
              
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] shadow-sm shrink-0 mt-0.5 font-black text-white">1</div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-1">Journal</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Notez vos revenus et dépenses quotidiennes. ZenBudget calcule instantanément l'impact sur votre mois.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] shadow-sm shrink-0 mt-0.5 font-black text-white">2</div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-1">Charges Fixes</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Automatisez vos abonnements et loyers. Ils sont projetés chaque mois pour anticiper vos dépenses.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Lexique des Indicateurs
              </h3>
              <div className="grid gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Solde Bancaire</span>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium italic">"Ce que j'ai en banque aujourd'hui"</p>
                  <p className="text-[10px] text-slate-400 mt-1">Somme de toutes vos opérations déjà passées. C'est votre photo à l'instant T.</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Disponible Réel</span>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium italic">"Ce que je peux vraiment dépenser"</p>
                  <p className="text-[10px] text-slate-400 mt-1">C'est votre Solde Bancaire moins les charges fixes (loyer, netflix...) qui ne sont pas encore tombées. Le chiffre le plus fiable.</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Fin de Mois</span>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium italic">"Mon solde final prévu"</p>
                  <p className="text-[10px] text-slate-400 mt-1">Projection incluant tout ce qui est prévu jusqu'à votre prochain cycle de salaire.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Configuration Cycle Budgétaire */}
      <section className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📅</span>
          <h2 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Cycle Budgétaire</h2>
        </div>
        <p className="text-[12px] text-gray-500 font-medium leading-relaxed">
          Définissez le jour où votre budget "redémarre" (souvent le jour du salaire).
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {[0, 24, 25, 26, 28].map((day) => (
            <button
              key={day}
              onClick={() => updateCycleDay(day)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                (activeAccount?.cycleEndDay || 0) === day 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
              }`}
            >
              {day === 0 ? 'Fin de mois' : `Le ${day}`}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-1 mt-1">
             <span className="text-[9px] font-bold text-slate-300">Perso :</span>
             <input 
              type="number" min="1" max="28" 
              placeholder="Ex: 25"
              value={activeAccount?.cycleEndDay || ''}
              onChange={(e) => updateCycleDay(parseInt(e.target.value) || 0)}
              className="w-12 bg-slate-50 border-none rounded-lg p-1 text-center text-[10px] font-black focus:ring-1 focus:ring-indigo-200"
             />
          </div>
        </div>
      </section>

      {/* Section Comptes */}
      <section>
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Mes Comptes</h2>
        <div className="space-y-3">
          {state.accounts.map(acc => (
            <div 
              key={acc.id} 
              className={`bg-white p-4 rounded-3xl border transition-all cursor-pointer ${state.activeAccountId === acc.id ? 'border-indigo-200 shadow-md ring-4 ring-indigo-50/50' : 'border-gray-100 opacity-80'}`}
              onClick={() => {
                if (editingAccountId !== acc.id && state.activeAccountId !== acc.id) {
                  onSetActiveAccount(acc.id);
                }
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                  {editingAccountId === acc.id ? (
                    <input 
                      autoFocus
                      className="bg-gray-50 border-none outline-none font-bold text-sm px-2 py-1 rounded w-full focus:ring-1 focus:ring-indigo-200"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="font-bold text-sm text-gray-800 truncate">{acc.name}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                  {editingAccountId !== acc.id && (
                    <>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEditing(acc); }} 
                        className="p-2.5 text-gray-400 hover:text-indigo-600 transition-colors rounded-xl hover:bg-indigo-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      
                      {state.accounts.length > 1 && (
                        <button 
                          type="button"
                          onClick={(e) => handleDelete(e, acc.id)} 
                          className="p-2.5 text-red-400 hover:text-red-600 transition-all rounded-xl hover:bg-red-50 active:scale-90"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isAddingAccount ? (
            <div className="bg-white p-4 rounded-3xl border-2 border-indigo-200 animate-in zoom-in duration-200">
              <input 
                autoFocus value={newAccName} onChange={e => setNewAccName(e.target.value)} 
                placeholder="Nom du compte..." 
                className="w-full bg-gray-50 p-3 rounded-xl mb-3 text-sm font-bold border-none outline-none focus:ring-1 focus:ring-indigo-200"
                onKeyDown={e => e.key === 'Enter' && createAccount()}
              />
              <div className="flex gap-2">
                <button onClick={() => setIsAddingAccount(false)} className="flex-1 py-2 text-[10px] font-black uppercase text-gray-400">Annuler</button>
                <button onClick={createAccount} className="flex-1 py-2 text-[10px] font-black uppercase text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">Créer</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAddingAccount(true)} className="w-full py-4 border-2 border-dashed border-gray-100 text-gray-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-3xl bg-white/50 hover:bg-white hover:text-indigo-600 transition-all">
              <IconPlus className="w-4 h-4" /> Nouveau compte
            </button>
          )}
        </div>
      </section>

      {/* Section Feedback */}
      <section className="bg-indigo-600 p-8 rounded-[40px] shadow-xl shadow-indigo-100 relative overflow-hidden text-center">
        <div className="relative z-10">
          <h3 className="text-white font-black text-lg mb-2">Une idée ? 🚀</h3>
          <p className="text-indigo-100 text-[11px] mb-6 font-medium leading-relaxed">
            Aidez-moi à faire grandir ZenBudget. Envoyez-moi un petit message pour toute suggestion ou bug !
          </p>
          <button 
            onClick={handleFeedback}
            className="w-full py-4 bg-white text-indigo-600 font-black rounded-2xl active:scale-95 transition-all uppercase text-[10px] tracking-widest"
          >
            Envoyer un retour par mail
          </button>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
      </section>

      {/* Danger Zone */}
      <section className="pt-4">
        <button 
          onClick={onReset}
          className="w-full py-4 bg-red-50 text-red-500 font-black rounded-2xl border border-red-100 active:scale-95 transition-all uppercase text-[10px] tracking-widest"
        >
          Effacer toutes les données
        </button>
      </section>

      <div className="pt-8 border-t border-gray-100">
        <p className="text-center text-[8px] text-gray-300 font-black uppercase tracking-[0.3em]">Version 3.9 • Données Privées • Local First</p>
      </div>
    </div>
  );
};

export default Settings;
