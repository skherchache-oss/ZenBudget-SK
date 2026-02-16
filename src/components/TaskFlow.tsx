
import React, { useMemo } from 'react';
import { Transaction, Category } from '../types';

interface TaskFlowProps {
  transactions: Transaction[];
  categories: Category[];
  month: number;
  year: number;
  onDelete: (id: string) => void;
}

const TaskFlow: React.FC<TaskFlowProps> = ({ transactions, categories, month, year, onDelete }) => {
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, month, year]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-4">📭</div>
        <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Aucune opération ce mois-ci</h3>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-slate-100">
      {filtered.map((t, idx) => {
        const cat = categories.find(c => c.id === t.categoryId);
        const date = new Date(t.date);
        
        return (
          <div key={t.id} className="relative pl-12 animate-in fade-in slide-in-from-left duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
            {/* Dot indicator */}
            <div className={`absolute left-0 top-2 w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm z-10 border-4 border-[#F8F9FD] ${t.type === 'INCOME' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}>
              <span className="text-sm font-black">{date.getDate()}</span>
            </div>

            <div className="bg-white p-5 rounded-[28px] shadow-sm border border-slate-100 group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat?.icon || '📦'}</span>
                  <span className="font-black text-xs text-slate-800 uppercase tracking-tight">{cat?.name}</span>
                </div>
                <div className={`text-sm font-black ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-400 font-medium truncate max-w-[180px]">
                  {t.comment || 'Sans description'}
                </p>
                {t.isRecurring && (
                  <span className="text-[7px] font-black uppercase px-2 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-100">⚡️ Fixe</span>
                )}
              </div>

              {/* Action simple pour supprimer si besoin */}
              <button 
                onClick={() => onDelete(t.id)}
                className="absolute -right-2 -top-2 w-6 h-6 bg-red-50 text-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-red-100"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TaskFlow;
