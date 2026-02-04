import React, { useState, useRef } from 'react'; 
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
  onShowWelcome: () => void; 
  onBackup: () => void;
  onImport: (file: File) => void;
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

  return ( 
    <div 
      className={`flex items-center justify-between bg-white rounded-2xl p-3.5 mb-2 border transition-all cursor-pointer ${isActive ? 'border-indigo-200 shadow-sm ring-2 ring-indigo-50' : 'border-slate-100 hover:border-slate-200'}`} 
      onClick={() => onSelect(acc.id)} 
    > 
      <div className="flex items-center gap-3 min-w-0"> 
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${acc.color}15` }}> 
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} /> 
        </div> 
        <div className="flex flex-col min-w-0"> 
          <span className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{acc.name}</span> 
          {isActive && <span className="text-[7px] font-black text-indigo-500 uppercase tracking-[0.1em]">Compte actif</span>} 
        </div> 
      </div> 

      <div className="flex items-center gap-1"> 
        <button onClick={(e) => { e.stopPropagation(); onRename(acc); }} className="p-2 text-slate-300 hover:text-indigo-600"> 
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> 
        </button> 
        {canDelete && ( 
          <button 
            onClick={handleDelete} 
            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${isConfirmingDelete ? 'bg-red-500 text-white' : 'text-red-200 hover:text-red-400'}`} 
          > 
            {isConfirmingDelete ? 'Sûr ?' : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} 
          </button> 
        )} 
      </div> 
    </div> 
  ); 
}; 

const Settings: React.FC<SettingsProps> = ({ state, onUpdateAccounts, onSetActiveAccount, onDeleteAccount, onReset, onShowWelcome, onBackup, onImport }) => { 
  const [isAddingAccount, setIsAddingAccount] = useState(false); 
  const [newAccName, setNewAccName] = useState(''); 
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null); 
  const [editName, setEditName] = useState(''); 
  const [manualDay, setManualDay] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId); 
  const currentCycleDay = activeAccount?.cycleEndDay || 0;
  const presets = [25, 26, 27, 28, 0];
  const isCustomDay = !presets.includes(currentCycleDay);

  const SectionTitle: React.FC<{ title: string }> = ({ title }) => ( 
    <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-3">{title}</h2> 
  ); 

  const handleCreateAccount = () => { 
    if (!newAccName.trim()) return; 
    const newAcc = createDefaultAccount(state.user?.id || 'local-user'); 
    newAcc.name = newAccName.trim(); 
    onUpdateAccounts([...state.accounts, newAcc]); 
    onSetActiveAccount(newAcc.id); 
    setNewAccName(''); 
    setIsAddingAccount(false); 
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

  const handleManualDayUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const day = parseInt(manualDay);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      updateCycleDay(day === 31 ? 0 : day);
      setManualDay('');
    }
  };

  return ( 
    <div className="space-y-6 pb-32 overflow-y-auto no-scrollbar h-full px-4 pt-6"> 
        
      <div className="bg-white p-4 rounded-[24px] border border-slate-50 flex items-center justify-between shadow-sm"> 
        <div className="flex items-center gap-3"> 
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">✨</div> 
          <div> 
            <h3 className="font-black text-slate-800 text-[13px] leading-tight">Session Locale</h3> 
            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">ZenBudget v5.4</p> 
          </div> 
        </div> 
      </div> 

      {/* Guide Zen remonté tout en haut sous "Session Locale" */}
      <section> 
        <SectionTitle title="Aide" /> 
        <div className="bg-white rounded-[24px] border border-slate-50 overflow-hidden shadow-sm"> 
          <button onClick={onShowWelcome} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"> 
            <div className="flex items-center gap-3"> 
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-sm group-active:scale-90 transition-transform">📖</div> 
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Guide Zen de l'application</span> 
            </div> 
            <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button> 
        </div> 
      </section>

      <section> 
        <SectionTitle title="Mes Comptes" /> 
        <div className="space-y-1"> 
          {state.accounts.map(acc => ( 
            <AccountItem key={acc.id} acc={acc} isActive={state.activeAccountId === acc.id} onDelete={onDeleteAccount} onRename={(a) => { setEditingAccountId(a.id); setEditName(a.name); }} onSelect={onSetActiveAccount} canDelete={state.accounts.length > 1} /> 
          ))} 
           
          {editingAccountId && ( 
            <div className="bg-white p-3 rounded-2xl border-2 border-indigo-100 mb-2"> 
              <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-50 p-2.5 rounded-xl mb-2 text-xs font-bold outline-none" /> 
              <div className="flex gap-2"> 
                <button onClick={() => setEditingAccountId(null)} className="flex-1 py-2 text-[9px] font-black uppercase text-slate-400">Annuler</button> 
                <button onClick={handleSaveRename} className="flex-1 py-2 text-[9px] font-black uppercase text-white bg-indigo-600 rounded-xl">Renommer</button> 
              </div> 
            </div> 
          )} 

          {!isAddingAccount ? ( 
            <button onClick={() => setIsAddingAccount(true)} className="w-full py-3.5 border-2 border-dashed border-slate-100 text-slate-300 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl hover:border-indigo-200 hover:text-indigo-400 transition-all"> 
              <IconPlus className="w-3 h-3" /> Ajouter un compte 
            </button> 
          ) : ( 
            <div className="bg-white p-3 rounded-2xl border-2 border-indigo-100 mt-2"> 
              <input autoFocus value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Nom du compte..." className="w-full bg-slate-50 p-2.5 rounded-xl mb-2 text-xs font-bold outline-none" /> 
              <div className="flex gap-2"> 
                <button onClick={() => setIsAddingAccount(false)} className="flex-1 py-2 text-[9px] font-black uppercase text-slate-400">Annuler</button> 
                <button onClick={handleCreateAccount} className="flex-1 py-2 text-[9px] font-black uppercase text-white bg-indigo-600 rounded-xl">Créer</button> 
              </div> 
            </div> 
          )} 
        </div> 
      </section>

      <section>
        <SectionTitle title="Cycle Budgétaire" />
        <div className="bg-white p-4 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed px-1">
            Définissez le jour de clôture du mois (jour de paie).
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {presets.map((day) => (
              <button
                key={day}
                onClick={() => updateCycleDay(day)}
                className={`py-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                  currentCycleDay === day
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-50 bg-slate-50 text-slate-400'
                }`}
              >
                <span className="text-[11px] font-black">{day === 0 ? '31' : day}</span>
                <span className="text-[5px] font-black uppercase tracking-tighter">{day === 0 ? 'Fin de mois' : 'Du mois'}</span>
              </button>
            ))}
            
            {isCustomDay && (
              <button
                onClick={() => {}}
                className="py-3 rounded-xl border-2 border-indigo-600 bg-indigo-600 text-white flex flex-col items-center justify-center gap-1 shadow-lg"
              >
                <span className="text-[11px] font-black">{currentCycleDay}</span>
                <span className="text-[5px] font-black uppercase tracking-tighter">Actif</span>
              </button>
            )}
          </div>
          <form onSubmit={handleManualDayUpdate} className="flex gap-2">
            <input 
              type="number" min="1" max="31" 
              value={manualDay} 
              onChange={e => setManualDay(e.target.value)} 
              placeholder={isCustomDay ? `Jour actuel: ${currentCycleDay}` : "Autre jour (1-31)"} 
              className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none placeholder:text-slate-300" 
            />
            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest">OK</button>
          </form>
        </div>
      </section>

      <section>
        <SectionTitle title="Sauvegarde" />
        <div className="bg-white rounded-[24px] border border-slate-50 overflow-hidden shadow-sm">
          <button onClick={onBackup} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px]">💾</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Exporter backup</span>
            </div>
          </button>
          <input type="file" ref={fileInputRef} hidden accept=".backup,.json" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white text-[10px]">📂</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Importer backup</span>
            </div>
          </button>
        </div>
      </section>

      <section className="pt-4 space-y-4"> 
        <div className="bg-slate-900 rounded-[32px] p-6 text-center relative overflow-hidden"> 
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/20 blur-3xl rounded-full" /> 
          <p className="text-[11px] font-medium text-indigo-100/80 mb-4 px-2 leading-relaxed"> 
            Un bug ou une idée ? Dites-le nous pour améliorer ZenBudget !
          </p> 
          <button  
            onClick={() => window.location.href = `mailto:s.kherchache@gmail.com?subject=ZenBudget : Retour Bug/Idée`}  
            className="w-full py-3.5 bg-white text-slate-900 font-black rounded-xl uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-xl" 
          > 
            Signaler un bug ou proposer une idée ✨ 
          </button> 
        </div> 

        <button  
          onClick={onReset}  
          className="w-full py-3 text-red-300 font-black uppercase text-[8px] tracking-[0.2em] active:scale-95 transition-all hover:bg-red-50 rounded-xl" 
        > 
          Réinitialiser les données 
        </button> 
      </section> 

      <div className="text-center pb-10"> 
        <p className="text-[7px] text-slate-200 font-black uppercase tracking-[0.5em]">Zen & Secure Financial Freedom</p> 
      </div> 
    </div> 
  ); 
}; 

export default Settings;