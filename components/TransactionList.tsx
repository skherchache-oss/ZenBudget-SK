
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
      if (isVirtual) {
        // On ne supprime pas une virtuelle (elle est juste une projection)
        onToggle();
        return;
      }
      if (!isConfirmingDelete) { setIsConfirmingDelete(true); return; }
      onDelete(t.id); setIsConfirmingDelete(false);
    } else { onEdit(t); }
    onToggle();
  };

  return (
    <div className="flex items-center bg-white first:rounded-t-[24px] last:rounded-b-[24px] relative overflow-hidden h-[68px]">
      <div className={`absolute inset-y-0 right-0 flex transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-20 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button onClick={(e) => handleAction(e, 'edit')} className="w-20 h-full bg-indigo-600 text-white flex flex-col items-center justify-center gap-1.5 transition-colors active:bg-indigo-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          <span className="text-[8px] font-black uppercase tracking-widest">Éditer</span>
        </button>
        <button onClick={(e) => handleAction(e, 'delete')} className={`w-20 h-full flex flex-col items-center justify-center gap-1.5 transition-all ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white active:bg-red-700'} ${isVirtual ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}>
          <span className="text-[8px] font-black uppercase px-2 text-center leading-tight tracking-widest">{isConfirmingDelete ? 'Sûr ?' : 'Supprimer'}</span>
        </button>
      </div>
      <div 
        className={`relative bg-white flex-1 h-full flex items-center gap-4 px-5 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-10 cursor-pointer ${!isLast ? 'border-b border-slate-50' : ''}`}
        style={{ transform: `translateX(${isOpen ? -threshold : 0}px)` }}
        onClick={onToggle}
      >
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 transition-transform ${isVirtual ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100 shadow-sm'}`}>
          {category?.icon || '❓'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-black text-slate-800 truncate flex items-center gap-1.5 uppercase tracking-tight">
            {category?.name}
            {isVirtual && <span className="text-amber-500 text-[9px] animate-pulse">⚡️</span>}
          </div>
          <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{t.comment || 'Note vide'}</div>
        </div>
        <div className={`text-sm font-black shrink-0 ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'} ${isVirtual ? 'opacity-60' : ''}`}>
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
  const today = new Date();
  const isThisMonth = today.getMonth() === month && today.getFullYear() === year;

  return (
    <div className="space-y-5 pb-24 animate-in fade-in duration-700">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-black tracking-tighter text-slate-800">Journal</h2>
        <div className="bg-slate-900 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-xl ring-4 ring-slate-100">
           <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Solde fin de mois</span>
           <span className={`text-sm font-black ${totalBalance >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
            {totalBalance.toLocaleString('fr-FR')}€
           </span>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner shrink-0">
        <button onClick={() => setViewMode('CALENDAR')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${viewMode === 'CALENDAR' ? 'bg-white text-slate-900 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}>Calendrier</button>
        <button onClick={() => setViewMode('LIST')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}>Liste</button>
      </div>

      {viewMode === 'CALENDAR' ? (
        <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
          <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-5 shadow-2xl shadow-slate-200/40 border border-white">
            <div className="grid grid-cols-7 mb-4">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d, i) => (
                <div key={i} className="text-center text-[8px] font-black uppercase text-slate-300 py-1 tracking-widest">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const balance = dailyBalances[day];
                const dayT = filteredTransactions.filter(t => new Date(t.date).getDate() === day);
                const hasIncome = dayT.some(t => t.type === 'INCOME');
                const hasExpense = dayT.some(t => t.type === 'EXPENSE');
                const isSelected = selectedDay === day;
                const isToday = isThisMonth && today.getDate() === day;
                
                return (
                  <button 
                    key={day} onClick={() => onSelectDay(day)}
                    className={`h-16 rounded-[22px] flex flex-col items-center justify-between py-2.5 transition-all duration-300 border relative ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-2xl z-10 scale-110' : (isToday ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-white border-slate-50 hover:bg-slate-50 active:scale-95')}`}
                  >
                    <span className={`text-[11px] font-black ${isSelected ? 'text-white' : 'text-slate-800'}`}>{day}</span>
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-[7px] font-black tracking-tighter leading-none ${isSelected ? 'text-indigo-300' : (balance >= 0 ? 'text-indigo-600' : 'text-red-500')}`}>
                        {Math.round(balance)}€
                      </span>
                      <div className="flex gap-0.5">
                        {hasIncome && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-400'}`} />}
                        {hasExpense && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-red-300' : 'bg-red-400'}`} />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Le {selectedDay} {MONTHS_FR[month]}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-300 uppercase">Projection:</span>
                <span className={`text-xs font-black ${dailyBalances[selectedDay || 1] >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{Math.round(dailyBalances[selectedDay || 1])}€</span>
              </div>
            </div>
            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/30 border border-slate-50 overflow-hidden divide-y divide-slate-50">
              {dayTransactions.length > 0 ? dayTransactions.map((t, idx) => (
                <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === dayTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
              )) : (
                <div className="py-10 flex flex-col items-center justify-center text-center opacity-40 grayscale">
                  <span className="text-3xl mb-2">🍃</span>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Journée calme</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-500">
           {/* Summary Header for List Mode */}
           <div className="bg-indigo-600 p-5 rounded-[32px] text-white shadow-xl shadow-indigo-200/50 flex justify-between items-center relative overflow-hidden">
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
             <div>
               <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200 block mb-1">Report du mois précédent</span>
               <div className="text-2xl font-black tracking-tight">{carryOver.toLocaleString('fr-FR')}€</div>
             </div>
             <div className="text-right">
               <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200 block mb-1">Mouvements {MONTHS_FR[month]}</span>
               <div className="text-lg font-bold">{(totalBalance - carryOver).toLocaleString('fr-FR')}€</div>
             </div>
           </div>

           <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/30 border border-slate-50 overflow-hidden divide-y divide-slate-50">
            {filteredTransactions.length > 0 ? filteredTransactions.map((t, idx) => (
              <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === filteredTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
            )) : <div className="p-16 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Aucune opération enregistrée</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
