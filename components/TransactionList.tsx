
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

const TransactionList: React.FC<TransactionListProps> = ({ transactions, categories, month, year, onDelete, onEdit, onAddAtDate }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('CALENDAR');
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getMonth() === month ? new Date().getDate() : 1);
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

  const handleAddAtSelectedDate = () => {
    if (selectedDay) {
      const dateStr = new Date(year, month, selectedDay, 12, 0, 0).toISOString();
      onAddAtDate(dateStr);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-gray-200/50 p-1 rounded-2xl border border-gray-100/50">
        <button onClick={() => setViewMode('CALENDAR')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-gray-900 shadow-sm' : 'text-slate-400'}`}>Calendrier</button>
        <button onClick={() => setViewMode('LIST')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'LIST' ? 'bg-white text-gray-900 shadow-sm' : 'text-slate-400'}`}>Liste</button>
      </div>

      {viewMode === 'CALENDAR' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] p-5 shadow-sm border border-gray-100">
            <div className="grid grid-cols-7 mb-4">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                <div key={d} className="text-center text-[8px] font-black uppercase text-gray-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
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
                    onClick={() => setSelectedDay(day)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all border relative ${selectedDay === day ? 'bg-gray-900 border-gray-900 text-white shadow-lg scale-105 z-10' : 'bg-gray-50/50 border-gray-100 hover:bg-gray-100'}`}
                  >
                    {hasFix && (
                      <div className={`absolute top-1 right-1 text-[7px] ${selectedDay === day ? 'text-amber-400' : 'text-amber-600'}`}>⚡️</div>
                    )}
                    <span className="text-[10px] font-bold">{day}</span>
                    <div className="flex gap-0.5 mt-1">
                      {hasInc && <div className={`w-1 h-1 rounded-full ${selectedDay === day ? 'bg-emerald-300' : 'bg-emerald-400'}`} />}
                      {hasExp && <div className={`w-1 h-1 rounded-full ${selectedDay === day ? 'bg-red-300' : 'bg-red-400'}`} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Opérations du {selectedDay}</h3>
              <button 
                onClick={handleAddAtSelectedDate}
                className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm border border-indigo-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            </div>
            <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {dayTransactions.length > 0 ? dayTransactions.map((t, idx) => (
                <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === dayTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
              )) : <div className="p-8 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest">Aucune opération</div>}
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
