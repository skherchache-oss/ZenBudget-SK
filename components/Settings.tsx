
import React, { useState } from 'react';
import { AppState, Category, BudgetAccount } from '../types';
import { IconPlus } from './Icons';
import { createDefaultAccount } from '../store';

interface SettingsProps {
  state: AppState;
  onUpdateCategories: (cats: Category[]) => void;
  onUpdateBudget: (val: number) => void;
  onUpdateAccounts: (accounts: BudgetAccount[]) => void;
  onSetActiveAccount: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onReset: () => void;
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ state, onUpdateAccounts, onSetActiveAccount, onDeleteAccount }) => {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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

  return (
    <div className="space-y-8 pb-10">
      <section className="bg-white p-6 rounded-[32px] border border-gray-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-xl">
            🧘‍♂️
          </div>
          <div>
            <h3 className="font-black text-gray-900 leading-none mb-1">Espace Zen</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stockage local & Sécurisé</p>
          </div>
        </div>
      </section>

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
                          title="Supprimer le compte"
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
                <button onClick={createAccount} className="flex-1 py-2 text-[10px] font-black uppercase text-white bg-indigo-600 rounded-xl">Créer</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAddingAccount(true)} className="w-full py-4 border-2 border-dashed border-gray-100 text-gray-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-3xl bg-white/50 hover:bg-white hover:text-indigo-600 transition-all">
              <IconPlus className="w-4 h-4" /> Nouveau compte
            </button>
          )}
        </div>
      </section>

      <div className="pt-12 border-t border-gray-100">
        <p className="text-center text-[8px] text-gray-300 font-black uppercase tracking-[0.3em]">Version 3.7 • Données Privées • Local First</p>
      </div>
    </div>
  );
};

export default Settings;
