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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Formatteur spécifique pour le calendrier afin d'optimiser l'espace
const formatCurrencyCalendar = (amount: number) => {
  const absAmount = Math.abs(amount);
  // Si le montant est supérieur à 999, on cache les décimales pour gagner de la place
  const showDecimals = absAmount < 1000;
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
};

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
      <div className={`absolute inset-y-0 right-0 flex transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-20 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button onClick={(e) => handleAction(e, 'edit')} className="w-20 h-full bg-indigo-600 text-white flex flex-col items-center justify-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          <span className="text-[8px] font-black uppercase tracking-widest">Éditer</span>
        </button>
        <button onClick={(e) => handleAction(e, 'delete')} className={`w-20 h-full flex flex-col items-center justify-center gap-1 transition-all ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
          <span className="text-[8px] font-black uppercase px-2 text-center leading-tight tracking-widest">{isConfirmingDelete ? 'Sûr ?' : 'Supprimer'}</span>
        </button>
      </div>
      <div className={`relative bg-white flex-1 h-full flex items-center gap-3 px-4 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-10 cursor-pointer ${!isLast ? 'border-b border-slate-50' : ''}`} style={{ transform: `translateX(${isOpen ? -threshold : 0}px)` }} onClick={onToggle}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${isVirtual ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100 shadow-sm'}`}>{category?.icon || '📦'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5"><span className="text-[13px] font-black text-slate-800 truncate uppercase tracking-tight">{category?.name}</span>{t.isRecurring && <span className="text-amber-500 text-[10px]">⚡️</span>}</div>
          <div className="text-[10px] text-slate-400 font-medium truncate">{t.comment || 'Note vide'}</div>
        </div>
        <div className={`text-[13px] font-black shrink-0 ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'} ${isVirtual ? 'opacity-60' : ''}`}>
          {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount)}€
        </div>
      </div>
    </div>
  );
};

const TransactionList: React.FC<TransactionListProps> = ({ transactions, categories, month, year, onDelete, onEdit, onAddAtDate, selectedDay, onSelectDay, totalBalance, carryOver, onMonthChange, slideDirection }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('CALENDAR');
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const dailyBalances = useMemo(() => {
    const days: Record<number, number> = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let running = carryOver;
    const txByDay: Record<number, Transaction[]> = {};
    
    transactions.forEach(t => {
      const d = new Date(t.date).getDate();
      if (!txByDay[d]) txByDay[d] = []; 
      txByDay[d].push(t);
    });

    for(let i = 1; i <= daysInMonth; i++) {
      (txByDay[i] || []).sort((a,b) => a.type === 'INCOME' ? -1 : 1).forEach(t => { 
        running += (t.type === 'INCOME' ? t.amount : -t.amount); 
      });
      days[i] = running;
    }
    return days;
  }, [transactions, carryOver, month, year]);

  const selectedDayTransactions = useMemo(() => {
    if (selectedDay === null) return [];
    return transactions.filter(t => new Date(t.date).getDate() === selectedDay);
  }, [transactions, selectedDay]);

  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isThisMonth = new Date().getMonth() === month && new Date().getFullYear() === year;

  return (
    <div className="space-y-3 pb-48 h-full overflow-y-auto no-scrollbar">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-black tracking-tighter text-slate-800">Journal</h2>
        <div className="bg-slate-900 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-lg">
           <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
             Fin de mois
           </span>
           <span className={`text-[12px] font-black ${totalBalance >= 0 ? 'text-indigo-400' : 'text-red-400'} whitespace-nowrap`}>
             {formatCurrency(totalBalance)}€
           </span>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner mb-1">
        <button onClick={() => setViewMode('CALENDAR')} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Calendrier</button>
        <button onClick={() => setViewMode('LIST')} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Liste</button>
      </div>

      <div className={slideDirection === 'next' ? 'slide-next' : slideDirection === 'prev' ? 'slide-prev' : 'fade-in'}>
        {viewMode === 'CALENDAR' ? (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="bg-white/70 backdrop-blur-xl rounded-[28px] p-3.5 shadow-xl border border-white">
              <div className="grid grid-cols-7 mb-2">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d, i) => (
                  <div key={i} className="text-center text-[8px] font-black uppercase text-slate-800 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const balance = dailyBalances[day] || 0;
                  const isSelected = selectedDay === day;
                  const isToday = isThisMonth && new Date().getDate() === day;
                  const dayT = transactions.filter(t => new Date(t.date).getDate() === day);
                  return (
                    <button key={day} onClick={() => onSelectDay(day)} className={`h-16 rounded-[16px] flex flex-col items-center justify-between py-2 transition-all border relative overflow-hidden ${isSelected ? 'bg-slate-900 border-slate-900 text-white z-10 scale-105' : (isToday ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-white border-slate-50')}`}>
                      <span className={`text-[13px] font-semibold leading-none ${isSelected ? 'text-white' : 'text-slate-400'}`}>{day}</span>
                      <div className="flex flex-col items-center justify-center w-full px-0.5 flex-1 mt-1">
                        <span className={`text-[12px] font-black tracking-tighter truncate w-full text-center leading-none ${isSelected ? 'text-indigo-300' : (balance >= 0 ? 'text-indigo-600' : 'text-red-500')}`}>
                          {formatCurrencyCalendar(balance)}
                        </span>
                        <div className="flex gap-0.5 mt-1.5">
                          {dayT.some(t => t.type === 'INCOME') && <div className="w-1 h-1 rounded-full bg-emerald-400" />}
                          {dayT.some(t => t.type === 'EXPENSE') && <div className="w-1 h-1 rounded-full bg-red-400" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {selectedDay ? `${selectedDay} ${MONTHS_FR[month]}` : "Jour sélectionné"}
                </h3>
              </div>
              <div className="bg-white rounded-[24px] shadow-sm border border-slate-50 overflow-hidden divide-y divide-slate-50">
                {selectedDayTransactions.length > 0 ? (
                  selectedDayTransactions.map((t, idx) => (
                    <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === selectedDayTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
                  ))
                ) : (
                  <div className="py-6 text-center px-4">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                      {selectedDay ? "Horizon dégagé, aucune opération." : "Touchez un jour pour voir les détails"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[24px] shadow-lg border border-slate-50 overflow-hidden divide-y divide-slate-50 animate-in fade-in duration-500">
            {transactions.length > 0 ? (
              transactions.map((t, idx) => (
                <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === transactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
              ))
            ) : (
              <div className="py-20 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Journal vide ce mois-ci</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;