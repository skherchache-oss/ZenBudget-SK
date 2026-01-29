
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
  carryOver: number;
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
    e.preventDefault(); e.stopPropagation();
    if (action === 'delete') {
      if (!isConfirmingDelete) { setIsConfirmingDelete(true); return; }
      onDelete(t.id); setIsConfirmingDelete(false);
    } else { onEdit(t); }
    onToggle();
  };

  return (
    <div className="flex items-center bg-white first:rounded-t-[20px] last:rounded-b-[20px] relative overflow-hidden h-[60px]">
      <div className={`absolute inset-y-0 right-0 flex transition-transform duration-300 ease-out z-20 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button onClick={(e) => handleAction(e, 'edit')} className="w-20 h-full bg-indigo-600 text-white flex flex-col items-center justify-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          <span className="text-[7px] font-black uppercase">Éditer</span>
        </button>
        <button onClick={(e) => handleAction(e, 'delete')} className={`w-20 h-full flex flex-col items-center justify-center gap-1 ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
          <span className="text-[7px] font-black uppercase px-2 text-center">{isConfirmingDelete ? 'Sûr ?' : (isVirtual ? 'Stop' : 'Suppr.')}</span>
        </button>
      </div>
      <div 
        className={`relative bg-white flex-1 h-full flex items-center gap-3 px-4 transition-transform duration-300 ease-out z-10 cursor-pointer ${!isLast ? 'border-b border-gray-50' : ''}`}
        style={{ transform: `translateX(${isOpen ? -threshold : 0}px)` }}
        onClick={onToggle}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0 ${isVirtual ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'}`}>
          {category?.icon || '❓'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
            {category?.name}
            {isVirtual && <span className="text-amber-500 text-[8px]">⚡️</span>}
          </div>
          <div className="text-[9px] text-slate-400 truncate mt-0.5">{t.comment || 'Note vide'}</div>
        </div>
        <div className={`text-xs font-black shrink-0 ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'} ${isVirtual ? 'opacity-70' : ''}`}>
          {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}€
        </div>
      </div>
    </div>
  );
};

const TransactionList: React.FC<TransactionListProps> = ({ transactions, categories, month, year, onDelete, onEdit, onAddAtDate, selectedDay, onSelectDay, totalBalance, carryOver }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('CALENDAR');
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, month, year]);

  const dailyBalances = useMemo(() => {
    const days: Record<number, number> = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Initialisation avec le vrai solde de report du mois précédent
    let running = carryOver;
    
    // On trie par ordre chronologique pour calculer le flux cumulé journalier
    const chronological = [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for(let i = 1; i <= daysInMonth; i++) {
      const dayTransactions = chronological.filter(t => new Date(t.date).getDate() === i);
      dayTransactions.forEach(t => {
        running += (t.type === 'INCOME' ? t.amount : -t.amount);
      });
      days[i] = running;
    }
    return days;
  }, [filteredTransactions, carryOver, month, year]);

  const dayTransactions = useMemo(() => {
    if (selectedDay === null) return [];
    return filteredTransactions.filter(t => new Date(t.date).getDate() === selectedDay);
  }, [selectedDay, filteredTransactions]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  return (
    <div className="space-y-3 pb-20">
      <div className="flex items-center justify-between px-1 shrink-0">
        <h2 className="text-lg font-black tracking-tighter text-slate-800">Journal</h2>
        <div className="bg-white border border-slate-100 rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-sm ring-1 ring-indigo-50/50 scale-90 origin-right">
           <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">Solde fin de mois</span>
           <span className={`text-xs font-black ${totalBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
            {totalBalance.toLocaleString('fr-FR')}€
           </span>
        </div>
      </div>

      <div className="flex bg-slate-200/30 p-1 rounded-xl shrink-0">
        <button onClick={() => setViewMode('CALENDAR')} className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Calendrier</button>
        <button onClick={() => setViewMode('LIST')} className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Liste</button>
      </div>

      {viewMode === 'CALENDAR' ? (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-white rounded-[24px] p-3 shadow-sm border border-slate-100">
            <div className="grid grid-cols-7 mb-1.5">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-center text-[7px] font-black uppercase text-slate-300 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const balance = dailyBalances[day];
                const hasFix = filteredTransactions.some(t => new Date(t.date).getDate() === day && t.isRecurring);
                
                return (
                  <button 
                    key={day} onClick={() => onSelectDay(day)}
                    className={`h-12 rounded-xl flex flex-col items-center justify-between py-1 transition-all border relative ${selectedDay === day ? 'bg-slate-900 border-slate-900 text-white shadow-lg z-10 scale-105' : 'bg-slate-50/20 border-slate-50 hover:bg-slate-100'}`}
                  >
                    <span className="text-[9px] font-black">{day}</span>
                    <div className="flex flex-col items-center">
                      <span className={`text-[7px] font-bold tracking-tighter leading-none ${selectedDay === day ? 'text-white/80' : (balance >= 0 ? 'text-indigo-600' : 'text-red-500')}`}>
                        {Math.round(balance)}
                      </span>
                      {hasFix && <div className={`w-0.5 h-0.5 rounded-full mt-0.5 ${selectedDay === day ? 'bg-amber-300' : 'bg-amber-400'}`} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-1.5">
            <h3 className="text-[7px] font-black uppercase tracking-widest text-slate-400 ml-1">Mouvements du {selectedDay}</h3>
            <div className="bg-white rounded-[18px] shadow-sm border border-slate-50 overflow-hidden divide-y divide-slate-50">
              {dayTransactions.length > 0 ? dayTransactions.map((t, idx) => (
                <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === dayTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
              )) : <div className="py-5 text-center text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Aucun mouvement</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[18px] shadow-sm border border-slate-50 overflow-hidden divide-y divide-slate-50 animate-in fade-in duration-300">
          {filteredTransactions.length > 0 ? filteredTransactions.map((t, idx) => (
            <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === filteredTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
          )) : <div className="p-10 text-center text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Le journal est vide</div>}
        </div>
      )}
    </div>
  );
};

export default TransactionList;
