
import React, { useState, useRef, useEffect } from 'react';
import { RecurringTemplate, TransactionType, Category } from '../types';
import { generateId } from '../store';
import { IconPlus } from './Icons';

interface RecurringManagerProps {
  recurringTemplates: RecurringTemplate[];
  categories: Category[];
  onUpdate: (templates: RecurringTemplate[]) => void;
  totalBalance: number;
}

const RecurringItem: React.FC<{
  tpl: RecurringTemplate;
  category?: any;
  isOpen: boolean;
  onToggleReveal: () => void;
  onDelete: (id: string) => void;
  onEdit: (tpl: RecurringTemplate) => void;
  onStatusToggle: (id: string) => void;
}> = ({ tpl, category, isOpen, onToggleReveal, onDelete, onEdit, onStatusToggle }) => {
  const threshold = 160;
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleDeleteAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    onDelete(tpl.id);
    onToggleReveal();
  };

  const handleEditAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(tpl);
    onToggleReveal();
  };

  useEffect(() => {
    if (!isOpen) setIsConfirmingDelete(false);
  }, [isOpen]);

  return (
    <div className="flex items-center mb-4 bg-white rounded-[32px] border border-gray-100 overflow-hidden relative h-24">
      <div className={`absolute inset-y-0 right-0 flex transition-transform duration-300 ease-out z-50 pointer-events-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button 
          onClick={handleEditAction} 
          className="w-20 h-full bg-indigo-600 text-white flex items-center justify-center active:bg-indigo-700 pointer-events-auto"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        <button 
          onClick={handleDeleteAction} 
          className={`w-20 h-full flex items-center justify-center transition-all ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white active:bg-red-700'}`}
        >
          {isConfirmingDelete ? (
            <span className="text-[10px] font-black uppercase">Sûr ?</span>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          )}
        </button>
      </div>

      <div 
        className={`relative bg-white flex items-center gap-4 p-5 transition-transform duration-300 ease-out z-10 select-none flex-1 cursor-pointer h-full ${!tpl.isActive ? 'opacity-50 grayscale' : ''}`}
        style={{ transform: `translateX(${isOpen ? -threshold : 0}px)` }}
        onClick={() => onToggleReveal()}
      >
        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl shrink-0">
          {category?.icon || '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-gray-900 truncate">{category?.name}</span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">Jour {tpl.dayOfMonth}</span>
          </div>
          <div className="text-[11px] text-gray-400 truncate mt-1">{tpl.comment || 'Charge fixe'}</div>
        </div>
        <div className="text-right flex flex-col items-end gap-2 shrink-0">
          <div className={`font-black text-lg leading-none ${tpl.type === 'INCOME' ? 'text-emerald-600' : 'text-gray-900'}`}>
            {tpl.amount.toFixed(2)}€
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onStatusToggle(tpl.id); }}
            className={`text-[8px] font-black px-3 py-1.5 rounded-full uppercase transition-all active:scale-95 border-2 ${tpl.isActive ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-100 border-gray-400 text-gray-500'}`}
          >
            {tpl.isActive ? 'Actif' : 'Pause'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RecurringManager: React.FC<RecurringManagerProps> = ({ recurringTemplates, categories, onUpdate, totalBalance }) => {
  const [editingTpl, setEditingTpl] = useState<RecurringTemplate | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [comment, setComment] = useState('');
  const [day, setDay] = useState('1');

  useEffect(() => {
    if (showAdd && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [showAdd, editingTpl]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId) return;
    const templateData: RecurringTemplate = {
      id: editingTpl?.id || generateId(),
      amount: parseFloat(amount),
      type,
      categoryId,
      comment,
      dayOfMonth: parseInt(day),
      isActive: editingTpl ? editingTpl.isActive : true
    };
    if (editingTpl) {
      onUpdate(recurringTemplates.map(t => t.id === editingTpl.id ? templateData : t));
    } else {
      onUpdate([...recurringTemplates, templateData]);
    }
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditingTpl(null);
    setShowAdd(false);
    setAmount('');
    setCategoryId('');
    setComment('');
    setDay('1');
    setType('EXPENSE');
  };

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <div className="space-y-6 pb-24">
      {/* En-tête avec Solde Élégant */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-black tracking-tighter text-slate-800">Charges Fixes</h2>
        <div className="bg-white border border-slate-100 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm">
           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Solde total</span>
           <span className={`text-sm font-black ${totalBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
            {totalBalance.toLocaleString('fr-FR')}€
           </span>
        </div>
      </div>

      <div className="bg-gray-900 text-white p-8 rounded-[48px] shadow-2xl relative overflow-hidden">
        <h2 className="text-xl font-logo font-extrabold mb-1 relative z-10 tracking-tight">Sérénité ⚡️</h2>
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest relative z-10 opacity-70">Abonnements et prélèvements récurrents</p>
      </div>

      <div className="space-y-2">
        {recurringTemplates.sort((a,b) => a.dayOfMonth - b.dayOfMonth).map(tpl => (
          <RecurringItem 
            key={tpl.id} 
            tpl={tpl} 
            category={categories.find(c => c.id === tpl.categoryId)} 
            isOpen={openItemId === tpl.id} 
            onToggleReveal={() => setOpenItemId(openItemId === tpl.id ? null : tpl.id)} 
            onDelete={(id) => onUpdate(recurringTemplates.filter(t => t.id !== id))} 
            onEdit={(t) => { 
              setEditingTpl(t); 
              setType(t.type); 
              setAmount(t.amount.toString()); 
              setCategoryId(t.categoryId); 
              setComment(t.comment || ''); 
              setDay(t.dayOfMonth.toString()); 
              setShowAdd(true); 
            }} 
            onStatusToggle={(id) => onUpdate(recurringTemplates.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t))} 
          />
        ))}

        <div ref={formRef} className="pt-4">
          {showAdd ? (
            <div className="bg-white p-6 rounded-[40px] border-2 border-indigo-100 shadow-xl shadow-indigo-100/20 animate-in slide-in-from-bottom duration-300">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-6 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-[10px]">✨</span>
                {editingTpl ? 'Modifier le prélèvement' : 'Nouveau prélèvement'}
              </h3>
              
              <form onSubmit={handleSave} className="space-y-6">
                <div className="flex p-1 bg-gray-100 rounded-2xl">
                  <button 
                    type="button"
                    onClick={() => { setType('EXPENSE'); setCategoryId(''); }}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500'}`}
                  >
                    Dépense
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setType('INCOME'); setCategoryId(''); }}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${type === 'INCOME' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500'}`}
                  >
                    Revenu
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-3xl">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1 block ml-1">Montant (€)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-transparent text-xl font-black w-full outline-none"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-3xl">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1 block ml-1">Jour du mois</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="31"
                      value={day}
                      onChange={e => setDay(e.target.value)}
                      className="bg-transparent text-xl font-black w-full outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-3 block ml-1">Catégorie</label>
                  <div className="grid grid-cols-4 gap-2">
                    {filteredCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryId(cat.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all border-2 ${
                          categoryId === cat.id 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-transparent bg-gray-50'
                        }`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-[8px] font-black text-gray-500 uppercase truncate w-full text-center tracking-tight">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <input 
                  type="text"
                  placeholder="Note (ex: Netflix, Loyer...)"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-100"
                />

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 rounded-2xl"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button 
              onClick={() => { cancelEdit(); setShowAdd(true); }} 
              className="w-full py-5 border-2 border-dashed border-gray-200 rounded-[32px] text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-3 bg-white/50"
            >
              <IconPlus className="w-6 h-6" /> Ajouter un prélèvement
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecurringManager;
