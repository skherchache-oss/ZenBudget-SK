
import React, { useMemo, useState } from 'react';
import { Transaction, Category } from '../types';
// Import missing MONTHS_FR constant
import { MONTHS_FR } from '../constants';

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
          <span className="text-[7px] font-black uppercase tracking-widest">Éditer</span>
        </button>
        <button onClick={(e) => handleAction(e, 'delete')} className={`w-20 h-full flex flex-col items-center justify-center gap-1 ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
          <span className="text-[7px] font-black uppercase px-2 text-center leading-tight">{isConfirmingDelete ? 'Sûr ?' : (isVirtual ? 'Annuler' : 'Suppr.')}</span>
        </button>
      </div>
      <div 
        className={`relative bg-white flex-1 h-full flex items-center gap-3 px-4 transition-transform duration-300 ease-out z-10 cursor-pointer ${!isLast ? 'border-b border-gray-50' : ''}`}
        style={{ transform: `translateX(${isOpen ? -threshold : 0}px)` }}
        onClick={onToggle}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0 ${isVirtual ? 'bg-amber-50 border border-amber-100 shadow-sm' : 'bg-slate-50'}`}>
          {category?.icon || '❓'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
            {category?.name}
            {isVirtual && <span className="text-amber-500 text-[8px] animate-pulse">⚡️</span>}
          </div>
          <div className="text-[9px] text-slate-400 truncate mt-0.5">{t.comment || 'Sans note'}</div>
        </div>
        <div className={`text-xs font-black shrink-0 ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'} ${isVirtual ? 'opacity-60' : ''}`}>
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
    
    let running = carryOver;
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
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between px-1 shrink-0">
        <h2 className="text-xl font-black tracking-tighter text-slate-800">Journal</h2>
        <div className="bg-white border border-slate-100 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm ring-2 ring-indigo-50/20 transition-all">
           <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Solde fin de mois</span>
           <span className={`text-xs font-black ${totalBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
            {totalBalance.toLocaleString('fr-FR')}€
           </span>
        </div>
      </div>

      <div className="flex bg-slate-200/40 p-1 rounded-xl shrink-0 transition-colors">
        <button onClick={() => setViewMode('CALENDAR')} className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Calendrier</button>
        <button onClick={() => setViewMode('LIST')} className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Liste</button>
      </div>

      {viewMode === 'CALENDAR' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="bg-white rounded-[28px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <div className="grid grid-cols-7 mb-3">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-center text-[7px] font-black uppercase text-slate-300 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const balance = dailyBalances[day];
                const hasActivity = filteredTransactions.some(t => new Date(t.date).getDate() === day);
                const isSelected = selectedDay === day;
                
                return (
                  <button 
                    key={day} onClick={() => onSelectDay(day)}
                    className={`h-14 rounded-xl flex flex-col items-center justify-between py-2 transition-all border relative ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-xl z-10 scale-105' : 'bg-white border-slate-50 hover:bg-slate-100'}`}
                  >
                    <span className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-800'}`}>{day}</span>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-[7px] font-black tracking-tighter leading-none ${isSelected ? 'text-white/80' : (balance >= 0 ? 'text-indigo-600' : 'text-red-500')}`}>
                        {Math.round(balance)}
                      </span>
                      {hasActivity && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-200'}`} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              {/* Reference to MONTHS_FR fixed by import */}
              <h3 className="text-[8px] font-black uppercase tracking-widest text-slate-400">Le {selectedDay} {MONTHS_FR[month]}</h3>
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-300">Solde journalier: {Math.round(dailyBalances[selectedDay || 1])}€</div>
            </div>
            <div className="bg-white rounded-[20px] shadow-sm border border-slate-50 overflow-hidden divide-y divide-slate-50">
              {dayTransactions.length > 0 ? dayTransactions.map((t, idx) => (
                <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === dayTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
              )) : <div className="py-6 text-center text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Aucun mouvement</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[20px] shadow-sm border border-slate-50 overflow-hidden divide-y divide-slate-50 animate-in fade-in duration-300">
          <div className="bg-slate-50/50 px-4 py-2 flex justify-between items-center border-b border-slate-100">
             <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">Report du mois précédent</span>
             <span className={`text-[9px] font-black ${carryOver >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{carryOver.toLocaleString('fr-FR')}€</span>
          </div>
          {filteredTransactions.length > 0 ? filteredTransactions.map((t, idx) => (
            <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === filteredTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
          )) : <div className="p-12 text-center text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Le journal est vide</div>}
        </div>
      )}
    </div>
  );
};

export default TransactionList;
