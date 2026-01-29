
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
    <div className="flex items-center bg-white first:rounded-t-[24px] last:rounded-b-[24px] relative overflow-hidden h-[72px]">
      <div className={`absolute inset-y-0 right-0 flex transition-transform duration-300 ease-out z-20 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button onClick={(e) => handleAction(e, 'edit')} className="w-20 h-full bg-indigo-600 text-white flex flex-col items-center justify-center gap-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          <span className="text-[8px] font-black uppercase">Éditer</span>
        </button>
        <button onClick={(e) => handleAction(e, 'delete')} className={`w-20 h-full flex flex-col items-center justify-center gap-1 ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white'} w-20`}>
          <span className="text-[8px] font-black uppercase text-center px-2">
            {isConfirmingDelete ? 'Sûr ?' : (isVirtual ? 'Stop' : 'Suppr.')}
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
          {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}€
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

  const dailyBalances = useMemo(() => {
    const days: Record<number, number> = {};
    let running = 0;
    // On doit calculer le cumul chronologique
    const chronological = [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Initialisation des jours du mois à 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for(let i = 1; i <= daysInMonth; i++) days[i] = 0;

    chronological.forEach(t => {
      const day = new Date(t.date).getDate();
      running += (t.type === 'INCOME' ? t.amount : -t.amount);
      // On met à jour le solde pour ce jour précis
      days[day] = running;
    });

    // On remplit les "trous" : si jour 2 n'a pas de transaction, son solde est celui du jour 1
    let lastKnown = 0;
    for(let i = 1; i <= daysInMonth; i++) {
      if (days[i] === 0) {
        // Vérifier s'il y a eu une transaction ce jour qui a fait 0, sinon prendre dernier connu
        const hasTrans = chronological.some(t => new Date(t.date).getDate() === i);
        if (!hasTrans) days[i] = lastKnown;
      }
      lastKnown = days[i];
    }
    
    return days;
  }, [filteredTransactions, month, year]);

  const dayTransactions = useMemo(() => {
    if (selectedDay === null) return [];
    return filteredTransactions.filter(t => new Date(t.date).getDate() === selectedDay);
  }, [selectedDay, filteredTransactions]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-black tracking-tighter text-slate-800">Journal</h2>
        <div className="bg-white border border-slate-100 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm ring-4 ring-indigo-50/50">
           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Solde actuel</span>
           <span className={`text-sm font-black ${totalBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
            {totalBalance.toLocaleString('fr-FR')}€
           </span>
        </div>
      </div>

      <div className="flex bg-gray-200/50 p-1 rounded-2xl border border-gray-100/50 shrink-0">
        <button onClick={() => setViewMode('CALENDAR')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-gray-900 shadow-sm' : 'text-slate-400'}`}>Calendrier</button>
        <button onClick={() => setViewMode('LIST')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'LIST' ? 'bg-white text-gray-900 shadow-sm' : 'text-slate-400'}`}>Liste</button>
      </div>

      {viewMode === 'CALENDAR' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-[32px] p-5 shadow-sm border border-gray-100">
            <div className="grid grid-cols-7 mb-3">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-center text-[9px] font-black uppercase text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const balance = dailyBalances[day];
                const hasFix = filteredTransactions.some(t => new Date(t.date).getDate() === day && t.isRecurring);
                
                return (
                  <button 
                    key={day} 
                    onClick={() => onSelectDay(day)}
                    className={`h-16 rounded-2xl flex flex-col items-center justify-between py-2.5 transition-all border relative ${selectedDay === day ? 'bg-slate-900 border-slate-900 text-white shadow-xl z-10' : 'bg-slate-50/40 border-slate-100 hover:bg-slate-100'}`}
                  >
                    <span className="text-[11px] font-black leading-none">{day}</span>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-[8px] font-black ${selectedDay === day ? 'text-white' : (balance >= 0 ? 'text-indigo-500' : 'text-red-500')}`}>
                        {Math.round(balance)}
                      </span>
                      {hasFix && (
                        <div className={`w-1 h-1 rounded-full ${selectedDay === day ? 'bg-amber-400' : 'bg-amber-500'}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-400">Détail du {selectedDay}</h3>
            </div>
            <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {dayTransactions.length > 0 ? dayTransactions.map((t, idx) => (
                <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === dayTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
              )) : <div className="py-8 text-center text-[9px] font-black text-gray-300 uppercase tracking-widest italic">Aucun mouvement</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {filteredTransactions.length > 0 ? filteredTransactions.map((t, idx) => (
            <TransactionItem key={t.id} t={t} category={categories.find(c => c.id === t.categoryId)} isLast={idx === filteredTransactions.length - 1} isOpen={openItemId === t.id} onToggle={() => setOpenItemId(openItemId === t.id ? null : t.id)} onDelete={onDelete} onEdit={onEdit} />
          )) : <div className="p-16 text-center text-[9px] font-black text-gray-300 uppercase tracking-widest">Journal vide</div>}
        </div>
      )}
    </div>
  );
};

export default TransactionList;
