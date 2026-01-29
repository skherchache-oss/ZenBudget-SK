import React, { useState, useEffect } from 'react';
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

  const filteredCategories = categories.filter(c => c.type === type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId) return;
    
    const [year, month, day] = date.split('-').map(Number);
    const secureDate = new Date(year, month - 1, day, 12, 0, 0).toISOString();

    onAdd({
      id: editItem?.id,
      amount: parseFloat(amount),
      type,
      categoryId,
      comment,
      date: secureDate,
      isRecurring
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all overflow-hidden">
      <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl p-6 overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom duration-300">
        
        {/* Header de la Modal */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-gray-900">{editItem ? 'Modifier' : 'Nouvelle'} opération</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400 active:scale-90">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pb-6">
          {/* Sélecteur Type */}
          <div className="flex p-1 bg-gray-100 rounded-2xl">
            <button 
              type="button"
              onClick={() => { setType('EXPENSE'); setCategoryId(''); }}
              className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-500'}`}
            >
              Dépense
            </button>
            <button 
              type="button"
              onClick={() => { setType('INCOME'); setCategoryId(''); }}
              className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${type === 'INCOME' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-500'}`}
            >
              Revenu
            </button>
          </div>

          {/* Saisie Montant */}
          <div className="text-center bg-gray-50 py-6 rounded-[32px] border border-gray-100">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-2 block">Montant (€)</label>
            <input 
              type="number" 
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-center text-5xl font-black focus:outline-none placeholder-gray-200 text-gray-900 bg-transparent border-none ring-0"
              autoFocus={!editItem}
              required
            />
          </div>

          {/* Liste Catégories */}
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
                    ? 'border-indigo-600 bg-indigo-50' 
                    : 'border-transparent bg-gray-50'
                  }`}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-[9px] font-black text-gray-600 truncate w-full text-center uppercase">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Options supplémentaires */}
          <div className="space-y-4">
            <input 
              type="text" 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Note (facultatif)"
              className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm font-black"
              />
              <button 
                type="button"
                onClick={() => setIsRecurring(!isRecurring)}
                className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                  isRecurring ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-transparent text-gray-400'
                }`}
              >
                <span className="text-[10px] font-black uppercase">Fixe</span>
              </button>
            </div>
          </div>

          {/* Bouton Validation */}
          <button 
            type="submit"
            className={`w-full py-5 text-white font-black rounded-2xl shadow-xl active:scale-[0.97] transition-all uppercase text-xs tracking-widest ${editItem ? 'bg-indigo-600' : 'bg-gray-900'}`}
          >
            {editItem ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;