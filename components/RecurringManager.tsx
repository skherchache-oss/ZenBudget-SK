
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  category?: Category;
  isOpen: boolean;
  onToggleReveal: () => void;
  onDelete: (id: string) => void;
  onEdit: (tpl: RecurringTemplate) => void;
  onStatusToggle: (id: string) => void;
}> = ({ tpl, category, isOpen, onToggleReveal, onDelete, onEdit, onStatusToggle }) => {
  const threshold = 160;
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleDeleteAction = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!isConfirmingDelete) { setIsConfirmingDelete(true); return; }
    onDelete(tpl.id); onToggleReveal();
  };

  const handleEditAction = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    onEdit(tpl); onToggleReveal();
  };

  return (
    <div className="flex items-center mb-3 bg-white rounded-[28px] border border-slate-100 overflow-hidden relative h-20 shadow-sm transition-all">
      <div className={`absolute inset-y-0 right-0 flex transition-transform duration-300 ease-out z-50 pointer-events-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button onClick={handleEditAction} className="w-20 h-full bg-indigo-600 text-white flex flex-col items-center justify-center active:bg-indigo-700 pointer-events-auto gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          <span className="text-[7px] font-black uppercase tracking-widest">Éditer</span>
        </button>
        <button onClick={handleDeleteAction} className={`w-20 h-full flex flex-col items-center justify-center transition-all gap-1 ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white active:bg-red-700'}`}>
          <span className="text-[9px] font-black uppercase text-center px-1">{isConfirmingDelete ? 'Sûr ?' : 'Suppr.'}</span>
        </button>
      </div>

      <div className={`relative bg-white flex items-center gap-4 p-4 transition-transform duration-300 ease-out z-10 select-none flex-1 cursor-pointer h-full ${!tpl.isActive ? 'opacity-50 grayscale' : ''}`} style={{ transform: `translateX(${isOpen ? -threshold : 0}px)` }} onClick={() => onToggleReveal()}>
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0 shadow-inner">{category?.icon || '📦'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-800 text-[13px] truncate uppercase tracking-tight">{category?.name}</span>
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 uppercase tracking-tighter">Le {tpl.dayOfMonth}</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">{tpl.comment || 'Flux fixe'}</div>
        </div>
        <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
          <div className={`font-black text-sm leading-none ${tpl.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'}`}>{tpl.type === 'INCOME' ? '+' : '-'}{Math.abs(tpl.amount).toLocaleString('fr-FR')}€</div>
          <button onClick={(e) => { e.stopPropagation(); onStatusToggle(tpl.id); }} className={`text-[7px] font-black px-2 py-1 rounded-full uppercase transition-all active:scale-95 border ${tpl.isActive ? 'bg-emerald-50 border-emerald-500/30 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>{tpl.isActive ? 'Actif' : 'En pause'}</button>
        </div>
      </div>
    </div>
  );
};

const RecurringManager: React.FC<RecurringManagerProps> = ({ recurringTemplates, categories, onUpdate, totalBalance }) => {
  const [editingTpl, setEditingTpl] = useState<RecurringTemplate | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [comment, setComment] = useState('');
  const [day, setDay] = useState('1');

  const totalRecurringExpenses = useMemo(() => {
    return recurringTemplates
      .filter(t => t.isActive && t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [recurringTemplates]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.abs(parseFloat(amount.replace(',', '.')));
    if (isNaN(parsedAmount) || !categoryId) return;
    
    const templateData: RecurringTemplate = {
      id: editingTpl?.id || generateId(),
      amount: parsedAmount,
      type, categoryId, comment,
      dayOfMonth: Math.min(31, Math.max(1, parseInt(day))),
      isActive: editingTpl ? editingTpl.isActive : true
    };
    if (editingTpl) onUpdate(recurringTemplates.map(t => t.id === editingTpl.id ? templateData : t));
    else onUpdate([...recurringTemplates, templateData]);
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditingTpl(null); setShowAdd(false); setAmount(''); setCategoryId(''); setComment(''); setDay('1'); setType('EXPENSE');
  };

  return (
    <div className="space-y-6 pb-32 h-full overflow-y-auto no-scrollbar px-1">
      <div className="flex items-center justify-between px-1 mt-4">
        <h2 className="text-xl font-black tracking-tighter text-slate-800 italic">Flux Fixes</h2>
      </div>

      {/* ENCADRÉ BLEU TOTAL CHARGES RÉCURRENTES */}
      <div className="bg-indigo-600 rounded-[32px] p-6 shadow-xl text-white relative overflow-hidden mb-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Total charges récurrentes</span>
          <div className="text-3xl font-black tracking-tighter mt-1">
            {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(totalRecurringExpenses)}€
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {recurringTemplates.map(tpl => (
          <RecurringItem 
            key={tpl.id} tpl={tpl} category={categories.find(c => c.id === tpl.categoryId)} 
            isOpen={openItemId === tpl.id} onToggleReveal={() => setOpenItemId(openItemId === tpl.id ? null : tpl.id)} 
            onDelete={(id) => onUpdate(recurringTemplates.filter(t => t.id !== id))} 
            onEdit={(t) => { setEditingTpl(t); setType(t.type); setAmount(t.amount.toString()); setCategoryId(t.categoryId); setComment(t.comment || ''); setDay(t.dayOfMonth.toString()); setShowAdd(true); }} 
            onStatusToggle={(id) => onUpdate(recurringTemplates.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t))} 
          />
        ))}

        {showAdd ? (
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl animate-in slide-in-from-bottom duration-300">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex p-1 bg-slate-100 rounded-2xl">
                <button type="button" onClick={() => setType('EXPENSE')} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400'}`}>Charge Fixe</button>
                <button type="button" onClick={() => setType('INCOME')} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${type === 'INCOME' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}>Revenu Fixe</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Montant</label>
                  <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="bg-transparent text-lg font-black w-full outline-none" required />
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Jour</label>
                  <input type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} className="bg-transparent text-lg font-black w-full outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {categories.filter(c => c.type === type).map(cat => (
                  <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)} className={`flex flex-col items-center p-2 rounded-xl border-2 ${categoryId === cat.id ? 'border-indigo-600 bg-indigo-50' : 'bg-slate-50 border-transparent'}`}>
                    <span className="text-xl">{cat.icon}</span>
                    <span className="text-[7px] font-black uppercase truncate w-full text-center">{cat.name}</span>
                  </button>
                ))}
              </div>
              <button type="submit" className="w-full py-5 text-[10px] font-black uppercase text-white bg-slate-900 rounded-2xl">Enregistrer</button>
              <button type="button" onClick={cancelEdit} className="w-full text-[9px] font-black uppercase text-slate-400 py-2">Annuler</button>
            </form>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-3 bg-white">
            <IconPlus className="w-5 h-5" /> Programmer un flux fixe
          </button>
        )}
      </div>
    </div>
  );
};

export default RecurringManager;
