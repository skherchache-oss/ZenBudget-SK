import React from 'react';
import { AppState, Category, BudgetAccount } from '../types';
import { saveState } from '../store';

interface SettingsProps {
  state: AppState;
  onUpdateCategories: (categories: Category[]) => void;
  onUpdateAccounts: (accounts: BudgetAccount[]) => void;
  onSetActiveAccount: (id: string) => void;
  onReset: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  state, 
  onSetActiveAccount, 
  onReset 
}) => {

  // Sécurité : si le state est mal chargé
  const accounts = state?.accounts || [];
  const activeAccountId = state?.activeAccountId || (accounts[0]?.id);

  const exportBackup = () => {
    try {
      const dataStr = JSON.stringify(state, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `zenbudget_backup_${new Date().toISOString().split('T')[0]}.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      alert("Erreur lors de l'exportation.");
    }
  };

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          saveState(json);
          window.location.reload();
        } catch (err) {
          alert("Le fichier est invalide.");
        }
      };
    }
  };

  return (
    <div className="flex flex-col h-full space-y-8 overflow-y-auto no-scrollbar pb-32 pt-6">
      <div className="px-1">
        <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Réglages ⚙️</h2>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Configuration & Sécurité</p>
      </div>

      {/* Section Comptes avec sécurité */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 px-1">Mes Comptes</h3>
        <div className="space-y-2">
          {accounts.length > 0 ? (
            accounts.map(account => (
              <button
                key={account.id}
                onClick={() => onSetActiveAccount(account.id)}
                className={`w-full p-4 rounded-3xl border-2 flex items-center justify-between transition-all ${
                  activeAccountId === account.id 
                  ? 'border-indigo-600 bg-indigo-50/50' 
                  : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex flex-col items-start">
                  <span className={`text-xs font-black uppercase ${activeAccountId === account.id ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {account.name || "Compte sans nom"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 italic">Solde : {(account.balance || 0).toFixed(2)}€</span>
                </div>
                {activeAccountId === account.id && (
                  <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
              </button>
            ))
          ) : (
            <p className="text-[10px] text-slate-400 italic px-2">Aucun compte trouvé.</p>
          )}
        </div>
      </section>

      {/* SECTION SÉCURITÉ */}
      <section className="bg-slate-900 rounded-[35px] p-6 shadow-xl space-y-6 mx-1">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1">Sauvegarde</h3>
          <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
            Téléchargez vos données pour les restaurer plus tard.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button 
            onClick={exportBackup}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span className="text-[11px] font-black uppercase tracking-widest">Exporter (JSON)</span>
          </button>

          <label className="w-full py-4 bg-slate-800 text-slate-300 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer border border-slate-700 text-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span className="text-[11px] font-black uppercase tracking-widest">Restaurer un fichier</span>
            <input type="file" accept=".json" onChange={importBackup} className="hidden" />
          </label>
        </div>
      </section>

      {/* Section Danger */}
      <section className="pt-4 px-2">
        <button 
          onClick={() => { if(window.confirm("Tout supprimer ?")) onReset(); }}
          className="w-full py-4 text-red-500 text-[10px] font-black uppercase tracking-[0.2em] border-2 border-red-50/50 rounded-2xl active:bg-red-50 transition-all"
        >
          Réinitialiser l'app
        </button>
      </section>
    </div>
  );
};

export default Settings;