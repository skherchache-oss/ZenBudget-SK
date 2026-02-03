import React from 'react';
import { AppState, BudgetAccount } from '../types';
import { saveState } from '../store';

interface SettingsProps {
  state: AppState;
  onUpdateAccounts: (accounts: BudgetAccount[]) => void;
  onSetActiveAccount: (id: string) => void;
  onReset: () => void;
  onShowWelcome: () => void;
  onShowRating: () => void;
}

const Settings: React.FC<SettingsProps> = ({ state, onSetActiveAccount, onReset, onShowWelcome, onShowRating }) => {
  const accounts = state?.accounts || [];
  const activeAccountId = state?.activeAccountId || (accounts[0]?.id || "");

  const exportBackup = () => {
    try {
      const dataStr = JSON.stringify(state, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', `zenbudget_backup.json`);
      linkElement.click();
    } catch(e) { alert("Erreur d'export"); }
  };

  return (
    <div className="flex flex-col h-full space-y-8 overflow-y-auto no-scrollbar pb-32 pt-6 px-1">
      <div>
        <h2 className="text-2xl font-black italic text-slate-800 tracking-tighter">Réglages ⚙️</h2>
        <p className="text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">Données & Assistance</p>
      </div>

      {/* Mes Comptes avec protection toFixed */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-black uppercase text-indigo-500 tracking-widest">Mes Comptes</h3>
        <div className="space-y-2">
          {accounts.map(acc => (
            <button key={acc.id} onClick={() => onSetActiveAccount(acc.id)} className={`w-full p-4 rounded-3xl border-2 text-left transition-all ${activeAccountId === acc.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-white shadow-sm'}`}>
              <div className="text-xs font-black uppercase text-slate-800">{acc?.name || "Compte"}</div>
              <div className="text-[10px] font-bold text-slate-400 italic">Solde : {Number(acc?.balance || 0).toFixed(2)}€</div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 rounded-[35px] p-6 shadow-xl space-y-4">
        <h3 className="text-[11px] font-black uppercase text-indigo-400 tracking-widest">Sauvegarde de sécurité</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={exportBackup} className="py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-lg">Exporter</button>
          <label className="py-4 bg-slate-800 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center cursor-pointer border border-slate-700 active:scale-95">
            Importer <input type="file" accept=".json" onChange={(e) => {
              const reader = new FileReader();
              if (e.target.files?.[0]) {
                reader.readAsText(e.target.files[0]);
                reader.onload = (f) => { 
                  try {
                    const data = JSON.parse(f.target?.result as string);
                    saveState(data);
                    window.location.reload();
                  } catch(err) { alert("Fichier JSON invalide"); }
                };
              }
            }} className="hidden" />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Support & Aide</h3>
        <button onClick={onShowWelcome} className="w-full p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-3 active:bg-slate-50 shadow-sm">
          <span className="text-lg">📖</span> <span className="text-[11px] font-black uppercase text-slate-600 tracking-widest">Comment ça marche ?</span>
        </button>
        <button onClick={() => window.location.href="mailto:s.kherchache@gmail.com?subject=Bug ZenBudget&body=Bonjour, j'ai trouvé un problème :"} className="w-full p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-3 active:bg-slate-50 shadow-sm">
          <span className="text-lg">🐞</span> <span className="text-[11px] font-black uppercase text-slate-600 tracking-widest">Signaler un bug</span>
        </button>
        <button onClick={() => window.location.href="mailto:s.kherchache@gmail.com?subject=Avis ZenBudget&body=Voici mon avis sur l'application :"} className="w-full p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-3 active:bg-slate-50 shadow-sm">
          <span className="text-lg">⭐</span> <span className="text-[11px] font-black uppercase text-slate-600 tracking-widest">Donner mon avis</span>
        </button>
      </section>

      <button onClick={() => { if(confirm("Supprimer toutes les données définitivement ?")) onReset(); }} className="w-full py-4 text-red-400 text-[9px] font-black uppercase tracking-[0.2em] border border-red-50 rounded-2xl mt-4 active:bg-red-50 transition-colors">Réinitialiser l'application</button>
    </div>
  );
};

export default Settings;