import React, { useState, useEffect, useRef } from 'react';
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
    <div className={`flex items-center justify-between bg-white rounded-2xl p-3.5 mb-2 border transition-all cursor-pointer ${isActive ? 'border-indigo-200 shadow-sm ring-2 ring-indigo-50' : 'border-slate-100 hover:border-slate-200'}`} onClick={() => onSelect(acc.id)}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${acc.color}15` }}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{acc.name}</span>
          {isActive && <span className="text-[7px] font-black text-indigo-500 uppercase tracking-[0.1em]">Actif</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); onRename(acc); }} className="p-2 text-slate-300 hover:text-indigo-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        {canDelete && (
          <button onClick={handleDelete} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${isConfirmingDelete ? 'bg-red-500 text-white' : 'text-red-200 hover:text-red-400'}`}>
            {isConfirmingDelete ? 'Sûr ?' : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
          </button>
        )}
      </div>
    </div>
  );
};

const Settings: React.FC<SettingsProps> = ({ state, onUpdateAccounts, onSetActiveAccount, onDeleteAccount, onReset, onBackup, onImport }) => {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId);
  const SectionTitle: React.FC<{ title: string }> = ({ title }) => <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-3">{title}</h2>;

  const handleCreateAccount = () => {
    if (!newAccName.trim()) return;
    const newAcc = createDefaultAccount(state.user?.id || 'local-user');
    newAcc.name = newAccName.trim();
    onUpdateAccounts([...state.accounts, newAcc]);
    onSetActiveAccount(newAcc.id);
    setNewAccName('');
    setIsAddingAccount(false);
  };

  return (
    <div className="space-y-6 pb-32 h-full">
      <section>
        <SectionTitle title="Sauvegarde" />
        <div className="bg-white rounded-3xl border border-slate-50 overflow-hidden shadow-sm">
          <button onClick={onBackup} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px]">💾</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Exporter (.json)</span>
            </div>
          </button>
          <input type="file" ref={fileInputRef} hidden accept=".json" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white text-[10px]">📂</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Importer</span>
            </div>
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
                <button onClick={() => { onUpdateAccounts(state.accounts.map(a => a.id === editingAccountId ? { ...a, name: editName } : a)); setEditingAccountId(null); }} className="flex-1 py-2 text-[9px] font-black uppercase text-white bg-indigo-600 rounded-xl">OK</button>
              </div>
            </div>
          )}
          {!isAddingAccount ? (
            <button onClick={() => setIsAddingAccount(true)} className="w-full py-3.5 border-2 border-dashed border-slate-100 text-slate-300 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl">+ Ajouter</button>
          ) : (
            <div className="bg-white p-3 rounded-2xl border-2 border-indigo-100 mt-2">
              <input autoFocus value={newAccName} onChange={e => setNewAccName(e.target.value)} className="w-full bg-slate-50 p-2.5 rounded-xl mb-2 text-xs font-bold outline-none" />
              <div className="flex gap-2">
                <button onClick={() => setIsAddingAccount(false)} className="flex-1 py-2 text-[9px] font-black uppercase text-slate-400">Annuler</button>
                <button onClick={handleCreateAccount} className="flex-1 py-2 text-[9px] font-black uppercase text-white bg-indigo-600 rounded-xl">Créer</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="pt-4">
        <button onClick={onReset} className="w-full py-3 text-red-300 font-black uppercase text-[8px] tracking-[0.2em] hover:bg-red-50 rounded-xl">
          Réinitialiser tout
        </button>
      </section>
    </div>
  );
};

export default Settings;