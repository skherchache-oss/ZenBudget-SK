
import React, { useMemo, useState } from 'react';
import { Transaction, Category } from '../types';
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
  cycleEndDay: number;
  onMonthChange: (offset: number) => void;
  slideDirection: 'next' | 'prev' | null;
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
    <div className="flex items-center bg-white first:rounded-t-[20px] last:rounded-b-[20px] relative overflow-hidden h-[60px]">
      <div className={`absolute inset-y-0 right-0 flex transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-20 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button onClick={(e) => handleAction(e, 'edit')} className="w-20 h-full bg-indigo-600 text-white flex flex-col items-center justify-center gap-1 transition-colors active:bg-indigo-700">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          <span className="text-[7px] font-black uppercase tracking-widest">Éditer</span>
        </button>
        <button onClick={(e) => handleAction(e, 'delete')} className={`w-20 h-full flex flex-col items-center justify-center gap-1 transition-all ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white active:bg-red-700'}`}>
          <span className="text-[7px] font-black uppercase px-2 text-center leading-tight tracking-widest">{isConfirmingDelete ? 'Sûr ?' : 'Supprimer'}</span>
        </button>
      </div>
      <div 
        className={`relative bg-white flex-1 h-full flex items-center gap-3 px-4 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-10 cursor-pointer ${!isLast ? 'border-b border-slate-50' : ''}`}
        style={{ transform: `translateX(${isOpen ? -threshold : 0}px)` }}
        onClick={onToggle}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 transition-transform ${isVirtual ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100 shadow-sm'}`}>
          {category?.icon || '❓'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-black text-slate-800 truncate uppercase tracking-tight">
              {category?.name}
            </span>
            {t.isRecurring && <span className="text-amber-500 text-[9px] shrink-0">⚡️</span>}
          </div>
          <div className="text-[9px] text-slate-400 font-medium truncate mt-0">{t.comment || 'Note vide'}</div>
        </div>
        <div className={`text-[13px] font-black shrink-0 ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'} ${isVirtual ? 'opacity-60' : ''}`}>
          {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}€
        </div>
      </div>
    </div>
  );
};

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, categories, month, year, onDelete, onEdit, onAddAtDate, selectedDay, onSelectDay, totalBalance, carryOver, cycleEndDay, onMonthChange, slideDirection 
}) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('CALENDAR');
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const projectionLabel = cycleEndDay > 0 ? `Projection au ${cycleEndDay}` : `Fin de mois`;

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

  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isThisMonth = today.getMonth() === month && today.getFullYear() === year;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (diff > 50) {
      onMonthChange(1);
    } else if (diff < -50) {
      onMonthChange(-1);
    }
    setTouchStart(null);
  };

  const animationClass = slideDirection === 'next' ? 'slide-next' : slideDirection === 'prev' ? 'slide-prev' : 'animate-in fade-in duration-500';

  return (
    <div 
      className="space-y-3 pb-24 h-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between px-1 mb-1">
        <h2 className="text-xl font-black tracking-tighter text-slate-800">Journal</h2>
        <div className="bg-slate-900 rounded-xl px-3 py-1.5 flex items-center gap-2.5 shadow-lg ring-2 ring-slate-100">
           <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400">{projectionLabel}</span>
           <span className={`text-[12px] font-black ${totalBalance >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
            {totalBalance.toLocaleString('fr-FR')}€
           </span>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner shrink-0">
        <button onClick={() => setViewMode('CALENDAR')} className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${viewMode === 'CALENDAR' ? 'bg-white text-slate-900 shadow-md scale-[1.01]' : 'text-slate-400 hover:text-slate-600'}`}>Calendrier</button>
        <button onClick={() => setViewMode('LIST')} className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-md scale-[1.01]' : 'text-slate-400 hover:text-slate-600'}`}>Liste</button>
      </div>

      <div key={`${month}-${year}`} className={animationClass}>
        {viewMode === 'CALENDAR' ? (
          <div className="space-y-4">
            <div className="bg-white/60 backdrop-blur-xl rounded-[32px] p-3 shadow-xl border border-white">
              <div className="grid grid-cols-7 mb-2">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d, i) => (
                  <div key={i} className="text-center text-[7px] font-black uppercase text-slate-300 py-0.5 tracking-widest">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const balance = dailyBalances[day];
                  const dayT = filteredTransactions.filter(t => new Date(t.date).getDate() === day);
                  const isSelected = selectedDay === day;
                  const isToday = isThisMonth && today.getDate() === day;
                  return (
                    <button key={day} onClick={() => onSelectDay(day)}
                      className={`h-12 rounded-[16px] flex flex-col items-center justify-between py-1.5 transition-all duration-300 border relative ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-2xl z-10 scale-105' : (isToday ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-white border-slate-50 hover:bg-slate-50 active:scale-95')}`}
                    >
                      <span className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-800'}`}>{day}</span>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-[6px] font-black tracking-tighter leading-none ${isSelected ? 'text-indigo-300' : (balance >= 0 ? 'text-indigo-600' : 'text-red-500')}`}>{Math.round(balance)}€</span>
                        <div className="flex gap-0.5">
                          {dayT.some(t => t.type === 'INCOME') && <div className="w-0.5 h-0.5 rounded-full bg-emerald-400" />}
                          {dayT.some(t => t.type === 'EXPENSE') && <div className="w-0.5 h-0.5 rounded-full bg-red-400" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Opérations du {selectedDay} {MONTHS_FR[month]}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-slate-300 uppercase">Solde :</span>
                  <span className={`text-[11px] font-black ${dailyBalances[selectedDay || 1] >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{Math.round(dailyBalances[selectedDay || 1])}€</span>
                </div>
              </div>
              <div className="bg-white rounded-[24px] shadow-lg border border-slate-50 overflow-hidden divide-y divide-slate-50">
                {dayTransactions.length > 0 ? dayTransactions.map((t, idx) => (
                  <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === dayTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
                )) : <div className="py-8 text-center opacity-40 italic text-[9px] font-black uppercase tracking-widest">Aucune opération</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
             <div className="bg-indigo-600 p-4 rounded-[24px] text-white shadow-xl flex justify-between items-center relative overflow-hidden">
               <div><span className="text-[8px] font-black uppercase tracking-widest text-indigo-200 block mb-0.5">Report précédent</span><div className="text-xl font-black tracking-tight">{carryOver.toLocaleString('fr-FR')}€</div></div>
               <div className="text-right"><span className="text-[8px] font-black uppercase tracking-widest text-indigo-200 block mb-0.5">Mouvements {MONTHS_FR[month]}</span><div className="text-md font-bold">{(totalBalance - carryOver).toLocaleString('fr-FR')}€</div></div>
             </div>
             <div className="bg-white rounded-[24px] shadow-lg border border-slate-50 overflow-hidden divide-y divide-slate-50">
              {filteredTransactions.length > 0 ? filteredTransactions.map((t, idx) => (
                <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === filteredTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
              )) : <div className="p-12 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Aucune opération</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
