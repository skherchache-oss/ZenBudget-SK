
import React, { useMemo, useState } from 'react';
import { Transaction, Category } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  month: number;
  year: number;
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
  onAddAtDate: (date: string) => void;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
  totalBalance: number;
}

const TransactionItem: React.FC<{ 
  t: Transaction; 
  category?: Category; 
  isLast: boolean; 
  isOpen: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
}> = ({ t, category, isLast, isOpen, onToggle, onDelete, onEdit }) => {
  const threshold = 160;
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const isVirtual = t.id.toString().startsWith('virtual-');

  const handleAction = (e: React.MouseEvent, action: 'edit' | 'delete') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (action === 'delete') {
      if (!isConfirmingDelete) {
        setIsConfirmingDelete(true);
        return;
      }
      onDelete(t.id);
      setIsConfirmingDelete(false);
    } else {
      onEdit(t);
    }
    onToggle();
  };

  return (
    <div className="flex items-center bg-white first:rounded-t-[28px] last:rounded-b-[28px] relative overflow-hidden h-[72px]">
      <div className={`absolute inset-y-0 right-0 flex transition-transform duration-300 ease-out z-20 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button onClick={(e) => handleAction(e, 'edit')} className="w-20 h-full bg-indigo-600 text-white flex flex-col items-center justify-center gap-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          <span className="text-[8px] font-black uppercase">Éditer</span>
        </button>
        <button onClick={(e) => handleAction(e, 'delete')} className={`w-20 h-full flex flex-col items-center justify-center gap-1 ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white'} w-20`}>
          <span className="text-[8px] font-black uppercase text-center px-2">
            {isConfirmingDelete 
              ? 'Confirmer' 
              : (isVirtual ? 'Désactiver' : 'Suppr.')}
          </span>
        </button>
      </div>

      <div 
        className={`relative bg-white flex-1 h-full flex items-center gap-3 px-4 transition-transform duration-300 ease-out z-10 cursor-pointer ${!isLast ? 'border-b border-gray-50' : ''}`}
        style={{ transform: `translateX(${isOpen ? -threshold : 0}px)` }}
        onClick={onToggle}
      >
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 ${isVirtual ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
          {category?.icon || '❓'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-800 truncate flex items-center gap-1.5">
            {category?.name}
            {isVirtual && <span className="text-amber-500 text-[10px]">⚡️</span>}
          </div>
          <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5 truncate">
            {t.comment || 'Sans note'}
          </div>
        </div>
        <div className={`text-sm font-black shrink-0 ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-gray-900'} ${isVirtual ? 'opacity-70' : ''}`}>
          {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
        </div>
      </div>
    </div>
  );
};

const TransactionList: React.FC<TransactionListProps> = ({ transactions, categories, month, year, onDelete, onEdit, onAddAtDate, selectedDay, onSelectDay, totalBalance }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('CALENDAR');
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, month, year]);

  const dayTransactions = useMemo(() => {
    if (selectedDay === null) return [];
    return filteredTransactions.filter(t => new Date(t.date).getDate() === selectedDay);
  }, [selectedDay, filteredTransactions]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  return (
    <div className="space-y-6">
      {/* En-tête avec Solde Élégant */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-black tracking-tighter text-slate-800">Journal</h2>
        <div className="bg-white border border-slate-100 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm">
           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Solde total</span>
           <span className={`text-sm font-black ${totalBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
            {totalBalance.toLocaleString('fr-FR')}€
           </span>
        </div>
      </div>

      <div className="flex bg-gray-200/50 p-1 rounded-2xl border border-gray-100/50">
        <button onClick={() => setViewMode('CALENDAR')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-gray-900 shadow-sm' : 'text-slate-400'}`}>Calendrier</button>
        <button onClick={() => setViewMode('LIST')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'LIST' ? 'bg-white text-gray-900 shadow-sm' : 'text-slate-400'}`}>Liste</button>
      </div>

      {viewMode === 'CALENDAR' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-[40px] p-6 shadow-sm border border-gray-100">
            <div className="grid grid-cols-7 mb-6">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                <div key={d} className="text-center text-[10px] font-black uppercase text-gray-400 tracking-tighter">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const daily = filteredTransactions.filter(t => new Date(t.date).getDate() === day);
                const hasExp = daily.some(t => t.type === 'EXPENSE');
                const hasInc = daily.some(t => t.type === 'INCOME');
                const hasFix = daily.some(t => t.isRecurring);
                
                return (
                  <button 
                    key={day} 
                    onClick={() => onSelectDay(day)}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all border relative ${selectedDay === day ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-110 z-10' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100'}`}
                  >
                    {hasFix && (
                      <div className={`absolute top-1.5 right-1.5 text-[8px] ${selectedDay === day ? 'text-amber-400' : 'text-amber-600'}`}>⚡️</div>
                    )}
                    <span className="text-sm font-black">{day}</span>
                    <div className="flex gap-1 mt-1.5">
                      {hasInc && <div className={`w-1.5 h-1.5 rounded-full ${selectedDay === day ? 'bg-emerald-300' : 'bg-emerald-400'}`} />}
                      {hasExp && <div className={`w-1.5 h-1.5 rounded-full ${selectedDay === day ? 'bg-red-300' : 'bg-red-400'}`} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Opérations du {selectedDay}</h3>
              <div className="text-[10px] font-medium text-gray-400 italic">Appuyez sur + pour ajouter</div>
            </div>
            <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {dayTransactions.length > 0 ? dayTransactions.map((t, idx) => (
                <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === dayTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
              )) : <div className="p-10 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest">Aucune opération</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {filteredTransactions.map((t, idx) => (
            <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === filteredTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionList;
