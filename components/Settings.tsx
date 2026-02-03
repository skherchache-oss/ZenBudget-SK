import React, { useState, useEffect } from 'react';
import { AppState, BudgetAccount, Transaction } from '../types';
import { IconPlus, IconExport } from './Icons';
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
  // Ajout de la fonction de sauvegarde
  onBackup: () => void;
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

const Settings: React.FC<SettingsProps> = ({ state, onUpdateAccounts, onSetActiveAccount, onDeleteAccount, onReset, onShowWelcome, onBackup }) => {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [customDay, setCustomDay] = useState('');

  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId);

  const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
    <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-3">{title}</h2>
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

  const handleExportCSV = () => {
    if (!activeAccount) return;
    const now = new Date();
    const currentBalance = activeAccount.transactions.reduce((acc, t) => {
      return new Date(t.date) <= now ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    let projectedEnd = currentBalance;
    const materializedIds = new Set(activeAccount.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).map(t => t.templateId).filter(Boolean));

    activeAccount.recurringTemplates?.forEach(tpl => {
        if (tpl.isActive && !materializedIds.has(tpl.id)) {
            projectedEnd += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
        }
    });

    const rows = [];
    rows.push(["RESUME DU COMPTE"]);
    rows.push(["Nom du compte", activeAccount.name]);
    rows.push(["Date d'export", now.toLocaleDateString()]);
    rows.push(["Solde Actuel", `${currentBalance.toFixed(2)} €`]);
    rows.push(["Disponible estime (Fin de mois)", `${projectedEnd.toFixed(2)} €`]);
    rows.push([]); 
    rows.push(["DETAILS DES OPERATIONS"]);
    rows.push(["Date", "Type", "Categorie", "Montant", "Note"]);
    
    activeAccount.transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(t => {
      const cat = state.categories.find(c => c.id === t.categoryId);
      rows.push([t.date.split('T')[0], t.type === 'INCOME' ? 'Revenu' : 'Depense', cat?.name || 'Inconnue', t.amount.toString().replace('.', ','), (t.comment || '').replace(/;/g, ',')]);
    });

    const csvContent = rows.map(e => e.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `zenbudget_${activeAccount.name.toLowerCase()}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6 pb-32 overflow-y-auto no-scrollbar h-full px-4 pt-6 fade-in">
      
      {/* PROFIL CARD */}
      <div className="bg-white p-4 rounded-[24px] border border-slate-50 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">✨</div>
          <div>
            <h3 className="font-black text-slate-800 text-[13px] leading-tight">Session Locale</h3>
            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">ZenBudget Premium v4.8</p>
          </div>
        </div>
      </div>

      {/* OUTILS ZEN */}
      <section>
        <SectionTitle title="Outils & Aide" />
        <div className="bg-white rounded-[24px] border border-slate-50 overflow-hidden shadow-sm">
          <button onClick={onShowWelcome} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-sm">📖</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Guide d'utilisation</span>
            </div>
            <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
          </button>
          
          {/* NOUVEAU : BOUTON BACKUP JSON */}
          <button onClick={onBackup} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px]">💾</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Sauvegarder les données (Backup)</span>
            </div>
            <svg className="w-3 h-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
          </button>

          <button onClick={handleExportCSV} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600"><IconExport className="w-4 h-4" /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Export CSV (Excel)</span>
            </div>
            <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </section>

      {/* MES COMPTES */}
      <section>
        <SectionTitle title="Mes Comptes" />
        <div className="space-y-1">
          {state.accounts.map(acc => (
            <AccountItem key={acc.id} acc={acc} isActive={state.activeAccountId === acc.id} onDelete={onDeleteAccount} onRename={(a) => { setEditingAccountId(a.id); setEditName(a.name); }} onSelect={onSetActiveAccount} canDelete={state.accounts.length > 1} />
          ))}
          
          {editingAccountId && (
            <div className="bg-white p-3 rounded-2xl border-2 border-indigo-100 mb-2 animate-in zoom-in-95">
              <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-50 p-2.5 rounded-xl mb-2 text-xs font-bold outline-none" />
              <div className="flex gap-2">
                <button onClick={() => setEditingAccountId(null)} className="flex-1 py-2 text-[9px] font-black uppercase text-slate-400">Annuler</button>
                <button onClick={handleSaveRename} className="flex-1 py-2 text-[9px] font-black uppercase text-white bg-indigo-600 rounded-xl">Renommer</button>
              </div>
            </div>
          )}

          {!isAddingAccount ? (
            <button onClick={() => setIsAddingAccount(true)} className="w-full py-3.5 border-2 border-dashed border-slate-100 text-slate-300 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl hover:border-indigo-200 hover:text-indigo-400 transition-all mt-2">
              <IconPlus className="w-3 h-3" /> Ajouter un compte
            </button>
          ) : (
            <div className="bg-white p-3 rounded-2xl border-2 border-indigo-100 mt-2 animate-in zoom-in-95">
              <input autoFocus value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Nom du compte..." className="w-full bg-slate-50 p-2.5 rounded-xl mb-2 text-xs font-bold outline-none" />
              <div className="flex gap-2">
                <button onClick={() => setIsAddingAccount(false)} className="flex-1 py-2 text-[9px] font-black uppercase text-slate-400">Annuler</button>
                <button onClick={handleCreateAccount} className="flex-1 py-2 text-[9px] font-black uppercase text-white bg-indigo-600 rounded-xl">Créer</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CYCLE */}
      <section>
        <SectionTitle title="Cycle Budgétaire" />
        <div className="bg-white p-4 rounded-[24px] border border-slate-50 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            {[0, 25, 26, 28].map(day => (
              <button key={day} onClick={() => updateCycleDay(day)} className={`flex-1 h-10 rounded-xl text-[10px] font-black transition-all ${activeAccount?.cycleEndDay === day ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                {day === 0 ? 'Fin' : day}
              </button>
            ))}
            <input 
              type="number" value={customDay} onChange={(e) => {
                const val = e.target.value.slice(0, 2);
                setCustomDay(val);
                const d = parseInt(val);
                if (d >= 1 && d <= 31) updateCycleDay(d);
              }} 
              placeholder="+"
              className={`w-10 h-10 text-center rounded-xl text-[10px] font-black outline-none border-2 ${customDay ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-transparent bg-slate-50 text-slate-400'}`}
            />
          </div>
          <p className="text-[9px] text-slate-400 font-medium text-center uppercase tracking-tight">Le budget se réinitialise le {activeAccount?.cycleEndDay === 0 ? 'dernier jour' : activeAccount?.cycleEndDay} du mois</p>
        </div>
      </section>

      {/* FEEDBACK & RESET */}
      <section className="pt-4 space-y-4">
        <div className="bg-slate-900 rounded-[32px] p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/20 blur-3xl rounded-full" />
          <p className="text-[11px] font-medium text-indigo-100/80 mb-4 px-2 leading-relaxed">
            Un bug ? Une idée ? Un avis ?<br/>
            ZenBudget évolue grâce à vos retours.
          </p>
          <button 
            onClick={() => window.location.href = `mailto:s.kherchache@gmail.com?subject=ZenBudget : Bug, Idée ou Avis`} 
            className="w-full py-3.5 bg-white text-slate-900 font-black rounded-xl uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-xl"
          >
            Envoyer un retour ✨
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
        <p className="text-[7px] text-slate-200 font-black uppercase tracking-[0.5em]">Crafted for Serenity</p>
      </div>
    </div>
  );
};

export default Settings;