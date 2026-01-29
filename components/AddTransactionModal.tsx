
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
  const [amount, setAmount] = useState(editItem?.amount.toString() || '');
  const [categoryId, setCategoryId] = useState(editItem?.categoryId || '');
  const [comment, setComment] = useState(editItem?.comment || '');
  const [date, setDate] = useState(initialDate.split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(editItem?.isRecurring || false);

  useEffect(() => {
    if (editItem) {
      setType(editItem.type);
      setAmount(editItem.amount.toString());
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

  // Sécurité : changer de catégorie si on change de type et que la sélection actuelle est invalide
  useEffect(() => {
    if (categoryId) {
      const exists = filteredCategories.some(c => c.id === categoryId);
      if (!exists && filteredCategories.length > 0) {
        setCategoryId('');
      }
    }
  }, [type, filteredCategories, categoryId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // On remplace la virgule par un point pour le calcul JS
    const sanitizedAmount = amount.replace(',', '.');
    const parsedAmount = parseFloat(sanitizedAmount);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0 || !categoryId) {
      return;
    }
    
    // Création de la date à 12h00 pour éviter les décalages de fuseau horaire
    const [year, month, day] = date.split('-').map(Number);
    const secureDate = new Date(year, month - 1, day, 12, 0, 0).toISOString();

    onAdd({
      id: editItem?.id, // Conservé pour l'édition d'une réelle
      amount: parsedAmount,
      type,
      categoryId,
      comment,
      date: secureDate,
      isRecurring
    });
  };

  const isFormValid = useMemo(() => {
    const val = parseFloat(amount.replace(',', '.'));
    return !isNaN(val) && val > 0 && categoryId !== '';
  }, [amount, categoryId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm transition-all overflow-hidden">
      <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] shadow-2xl p-7 overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">{editItem ? 'Mise à jour' : 'Nouvelle opération'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400 active:scale-90">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          <div className="flex p-1 bg-gray-100 rounded-2xl shrink-0">
            <button 
              type="button"
              onClick={() => setType('EXPENSE')}
              className={`flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Dépense
            </button>
            <button 
              type="button"
              onClick={() => setType('INCOME')}
              className={`flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${type === 'INCOME' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Revenu
            </button>
          </div>

          <div className="text-center bg-gray-50/50 py-8 rounded-[40px] border border-gray-100/50">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-2 block">Somme en euros</label>
            <div className="flex items-center justify-center px-4">
              <input 
                type="text" 
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-center text-6xl font-black focus:outline-none placeholder-gray-200 text-gray-900 bg-transparent border-none ring-0"
                autoFocus={!editItem}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-4 block ml-1">Catégorie</label>
            <div className="grid grid-cols-4 gap-3">
              {filteredCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border-2 ${
                    categoryId === cat.id 
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                    : 'border-transparent bg-gray-50/80 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-[9px] font-black text-gray-600 truncate w-full text-center uppercase tracking-tight leading-none">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100/50">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-2 block">Détails</label>
              <input 
                type="text" 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex: Courses, Virement..."
                className="w-full bg-transparent border-none focus:ring-0 transition text-sm font-semibold text-gray-800 p-0"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100/50">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-2 block">Date</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 transition text-sm font-black text-gray-800 p-0"
                />
              </div>
              <div className="flex items-center justify-center">
                <button 
                  type="button"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl border-2 transition-all w-full justify-center ${
                    isRecurring ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-transparent text-gray-400'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${isRecurring ? 'border-emerald-600' : 'border-gray-300'}`}>
                    {isRecurring && <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Fixe</span>
                </button>
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={!isFormValid}
            className={`w-full py-6 text-white font-black rounded-[24px] shadow-2xl active:scale-[0.98] transition-all transform tracking-[0.2em] uppercase text-xs ${
              !isFormValid 
                ? 'bg-gray-200 cursor-not-allowed text-gray-400 shadow-none' 
                : (editItem ? 'bg-indigo-600 shadow-indigo-200' : 'bg-gray-900 shadow-gray-200')
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
