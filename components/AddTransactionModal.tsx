import React, { useState, useEffect, useMemo } from 'react';
import { Category, TransactionType, Transaction } from '../types';

interface AddTransactionModalProps {
  categories: Category[];
  onClose: () => void;
  onAdd: (t: Omit<Transaction, 'id'> & { id?: string }) => void;
  initialDate: string;
  editItem?: Transaction | null;
}

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ categories, onClose, onAdd, initialDate, editItem }) => {
  const [type, setType] = useState<TransactionType>(editItem?.type || 'EXPENSE');
  const [amount, setAmount] = useState(editItem?.amount ? editItem.amount.toString().replace('.', ',') : '');
  const [categoryId, setCategoryId] = useState(editItem?.categoryId || '');
  const [comment, setComment] = useState(editItem?.comment || '');
  const [date, setDate] = useState(initialDate.split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(editItem?.isRecurring || false);

  useEffect(() => {
    window.history.pushState({ modalOpen: true }, '');
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.modalOpen) window.history.back();
    };
  }, [onClose]);

  useEffect(() => {
    if (editItem) {
      setType(editItem.type);
      setAmount(editItem.amount.toString().replace('.', ','));
      setCategoryId(editItem.categoryId);
      setComment(editItem.comment || '');
      setDate(editItem.date.split('T')[0]);
      setIsRecurring(editItem.isRecurring);
    }
  }, [editItem]);

  const filteredCategories = useMemo(() => 
    categories.filter(c => c.type === type),
    [categories, type]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0 || !categoryId) return;
    
    const [year, month, day] = date.split('-').map(Number);
    const secureDate = new Date(year, month - 1, day, 12, 0, 0).toISOString();

    onAdd({
      id: editItem?.id,
      amount: parsedAmount,
      type,
      categoryId,
      comment,
      date: secureDate,
      isRecurring,
      templateId: editItem?.templateId
    });
  };

  const isFormValid = useMemo(() => {
    const val = parseFloat(amount.replace(',', '.'));
    return !isNaN(val) && val > 0 && categoryId !== '';
  }, [amount, categoryId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 bg-slate-900/60 backdrop-blur-sm transition-all">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] shadow-2xl p-6 pb-8 relative z-10 animate-in slide-in-from-bottom duration-300 no-scrollbar overflow-y-auto max-h-[96vh]">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <button onClick={onClose} className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-slate-900 border-4 border-white active:scale-90 transition-transform"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
          <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] drop-shadow-md">Fermer</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          {/* TYPE SELECTOR */}
          <div className="flex p-1 bg-slate-100 rounded-2xl">
            <button type="button" onClick={() => setType('EXPENSE')} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.15em] transition-all ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow-lg' : 'text-slate-400'}`}>Dépense</button>
            <button type="button" onClick={() => setType('INCOME')} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.15em] transition-all ${type === 'INCOME' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}>Revenu</button>
          </div>

          {/* AMOUNT COMPACT */}
          <div className="text-center bg-slate-50 py-3.5 rounded-[28px] border border-slate-100 shadow-inner">
            <label className="text-[7px] font-black uppercase text-slate-400 tracking-[0.2em] mb-0.5 block">Montant (€)</label>
            <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="w-full text-center text-4xl font-black focus:outline-none placeholder-slate-200 text-slate-900 bg-transparent border-none ring-0" autoFocus={!editItem} />
          </div>

          {/* CATEGORIES GRID */}
          <div className="max-h-[140px] overflow-y-auto no-scrollbar py-1">
            <div className="grid grid-cols-4 gap-2">
              {filteredCategories.map(cat => (
                <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)} className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl transition-all border-2 ${categoryId === cat.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-[8px] font-black text-slate-600 truncate w-full text-center uppercase tracking-tight leading-none">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* NOTE FIELD SPACIOUS */}
          <div className="relative bg-slate-50 rounded-[24px] border border-slate-100 p-4 shadow-inner">
             <label className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1.5 block">Note ou libellé</label>
             <textarea 
               value={comment} 
               onChange={(e) => setComment(e.target.value)} 
               placeholder="Précisez votre opération..." 
               rows={2}
               className="w-full bg-transparent border-none p-0 text-[13px] font-bold text-slate-800 focus:ring-0 resize-none placeholder-slate-300 leading-relaxed" 
             />
          </div>

          {/* DATE & RECURRENCE - HIGH VISIBILITY */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative bg-white border-2 border-slate-300 rounded-[22px] p-3 flex flex-col justify-center active:border-indigo-400 focus-within:border-indigo-400 transition-all">
              <span className="text-[7px] font-black uppercase text-slate-400 mb-1 tracking-widest">Date échéance</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent border-none p-0 text-[12px] font-black text-slate-800 outline-none w-full" />
            </div>
            
            <button 
              type="button" 
              onClick={() => setIsRecurring(!isRecurring)} 
              className={`rounded-[22px] border-2 transition-all p-3 flex flex-col items-center justify-center gap-0.5 ${isRecurring ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-300 text-slate-400'}`}
            >
              <span className="text-[7px] font-black uppercase tracking-widest">Fréquence</span>
              <span className="text-[12px] font-black">{isRecurring ? 'Flux Fixe ✓' : 'Ponctuel'}</span>
            </button>
          </div>

          <button 
            type="submit" 
            disabled={!isFormValid} 
            className={`w-full py-5 text-white font-black rounded-[28px] shadow-xl active:scale-[0.98] transition-all tracking-[0.2em] uppercase text-[11px] mt-1 ${!isFormValid ? 'bg-slate-200 cursor-not-allowed' : 'bg-slate-900'}`}
          >
            {editItem ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;