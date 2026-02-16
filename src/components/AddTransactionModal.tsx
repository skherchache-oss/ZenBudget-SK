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

  // Synchronisation lors de l'édition ou du changement de date sélectionnée
  useEffect(() => {
    if (editItem) {
      setType(editItem.type);
      setAmount(editItem.amount.toString().replace('.', ','));
      setCategoryId(editItem.categoryId);
      setComment(editItem.comment || '');
      setDate(editItem.date.split('T')[0]);
      setIsRecurring(editItem.isRecurring);
    } else {
      setDate(initialDate.split('T')[0]);
    }
  }, [editItem, initialDate]);

  // Filtrage dynamique : s'adapte automatiquement aux catégories ajoutées/supprimées
  const filteredCategories = useMemo(() => {
    const filtered = categories.filter(c => c.type === type);
    
    // Sécurité : si la catégorie sélectionnée n'existe plus dans le state global, on reset la sélection
    if (categoryId && !categories.find(c => c.id === categoryId)) {
        setCategoryId('');
    }
    
    return filtered;
  }, [categories, type, categoryId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Toujours prendre la valeur absolue du montant
    const parsedAmount = Math.abs(parseFloat(amount.replace(',', '.')));
    if (isNaN(parsedAmount) || parsedAmount <= 0 || !categoryId) return;
    
    // On cale l'heure à midi pour éviter les décalages de fuseau horaire
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
    return !isNaN(val) && Math.abs(val) > 0 && categoryId !== '';
  }, [amount, categoryId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] shadow-2xl p-6 pb-8 relative z-10 animate-in slide-in-from-bottom sm:zoom-in duration-300">
        {/* Barre de saisie rapide sur mobile */}
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6 sm:hidden" />

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sélecteur de type */}
          <div className="flex p-1 bg-slate-100 rounded-2xl">
            <button 
              type="button" 
              onClick={() => { setType('EXPENSE'); setCategoryId(''); }} 
              className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow-lg shadow-red-100' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Dépense
            </button>
            <button 
              type="button" 
              onClick={() => { setType('INCOME'); setCategoryId(''); }} 
              className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${type === 'INCOME' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Revenu
            </button>
          </div>

          {/* Montant - Focus visuel fort */}
          <div className="text-center bg-slate-50 py-5 rounded-[32px] border border-slate-100 shadow-inner group">
            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1 block group-focus-within:text-indigo-500 transition-colors">Montant (€)</label>
            <input 
              type="text" 
              inputMode="decimal" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="0,00" 
              className="w-full text-center text-5xl font-black focus:outline-none placeholder-slate-200 text-slate-900 bg-transparent" 
              autoFocus 
            />
          </div>

          {/* Liste des Catégories - S'adapte dynamiquement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Catégorie</label>
              {categoryId && <span className="text-[8px] font-black text-indigo-500 uppercase animate-in fade-in">Sélectionné ✓</span>}
            </div>
            <div className="max-h-[160px] overflow-y-auto no-scrollbar py-1 px-1">
              <div className="grid grid-cols-4 gap-3">
                {filteredCategories.map(cat => (
                  <button 
                    key={cat.id} 
                    type="button" 
                    onClick={() => setCategoryId(cat.id)} 
                    className={`flex flex-col items-center gap-2 p-3 rounded-[22px] transition-all border-2 relative ${
                      categoryId === cat.id 
                        ? 'border-indigo-600 bg-indigo-50 shadow-md scale-95' 
                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-[7px] font-black text-slate-700 truncate w-full text-center uppercase tracking-tight">
                      {cat.name}
                    </span>
                    {categoryId === cat.id && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center text-[8px] text-white animate-in zoom-in">
                        ✓
                      </div>
                    )}
                  </button>
                ))}
                {filteredCategories.length === 0 && (
                  <div className="col-span-4 py-4 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    Aucune catégorie disponible
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Note & Commentaire */}
          <div className="bg-slate-50 rounded-[24px] border border-slate-100 p-4 transition-all focus-within:bg-white focus-within:border-indigo-100 focus-within:shadow-sm">
             <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Note personnelle</label>
             <input 
               type="text" 
               value={comment} 
               onChange={(e) => setComment(e.target.value)} 
               placeholder="Ajouter un détail..." 
               className="w-full bg-transparent border-none p-0 text-[14px] font-bold text-slate-800 focus:ring-0 placeholder:text-slate-300" 
             />
          </div>

          {/* Date et Fréquence */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border-2 border-slate-100 rounded-[24px] p-3 flex flex-col justify-center">
              <span className="text-[7px] font-black uppercase text-slate-400 block mb-1">Date de l'opération</span>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="bg-transparent border-none p-0 text-[12px] font-black text-slate-800 w-full outline-none" 
              />
            </div>
            <button 
              type="button" 
              onClick={() => setIsRecurring(!isRecurring)} 
              className={`rounded-[24px] border-2 transition-all p-3 flex flex-col items-center justify-center ${
                isRecurring 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
              }`}
            >
              <span className="text-[7px] font-black uppercase tracking-widest">Type de flux</span>
              <span className="text-[11px] font-black">{isRecurring ? '🔄 RÉCURRENT' : '⚡ PONCTUEL'}</span>
            </button>
          </div>

          {/* Bouton de validation massif */}
          <button 
            type="submit" 
            disabled={!isFormValid} 
            className={`w-full py-5 text-white font-black rounded-[28px] shadow-2xl transition-all uppercase text-[12px] tracking-[0.2em] active:scale-95 ${
              !isFormValid 
                ? 'bg-slate-200 cursor-not-allowed text-slate-400 shadow-none' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 shadow-lg'
            }`}
          >
            {editItem ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;