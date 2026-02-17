import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RecurringTemplate, TransactionType, Category } from '../types';
import { generateId } from '../store';
import { IconPlus } from './Icons';
import { ArrowUpCircle, PieChart, ChevronDown, ChevronRight, List, Edit3 } from 'lucide-react';

interface RecurringManagerProps {
  recurringTemplates: RecurringTemplate[];
  categories: Category[];
  onUpdate: (templates: RecurringTemplate[]) => void;
  totalBalance: number;
  month: number;
  year: number;
  onMonthChange: (offset: number) => void;
}

// --- COMPOSANT GRAPHIQUE ---
const RecurringPieChart: React.FC<{ data: { name: string, value: number, color: string }[], total: number }> = ({ data, total }) => {
  let cumulativePercent = 0;
  function getCoordinatesForPercent(percent: number) {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  }
  return (
    <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
      <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
        {total === 0 ? (
          <circle cx="0" cy="0" r="1" fill="#f1f5f9" />
        ) : (
          data.map((slice, i) => {
            const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
            cumulativePercent += slice.value / total;
            const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
            const largeArcFlag = slice.value / total > 0.5 ? 1 : 0;
            const pathData = [`M ${startX} ${startY}`, `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, `L 0 0`].join(' ');
            return <path key={i} d={pathData} fill={slice.color} className="transition-all duration-500" />;
          })
        )}
        <circle cx="0" cy="0" r="0.78" fill="white" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter italic">Total Charges</span>
        <span className="text-xl font-black text-slate-900 leading-none">
          -{Math.round(total).toLocaleString('fr-FR')}€
        </span>
      </div>
    </div>
  );
};

const RecurringItem: React.FC<{
  tpl: RecurringTemplate;
  category?: Category;
  isOpen: boolean;
  onToggleReveal: () => void;
  onDelete: (id: string) => void;
  onEdit: (tpl: RecurringTemplate) => void;
  onStatusToggle: (id: string) => void;
}> = ({ tpl, category, isOpen, onToggleReveal, onDelete, onEdit, onStatusToggle }) => {
  const threshold = 160;
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleDeleteAction = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!isConfirmingDelete) { setIsConfirmingDelete(true); return; }
    onDelete(tpl.id); onToggleReveal();
  };

  const handleEditAction = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    onEdit(tpl); onToggleReveal();
  };

  return (
    <div className="flex items-center mb-1.5 bg-slate-50/40 rounded-xl border border-slate-100 overflow-hidden relative h-14 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {/* Actions de swipe */}
      <div className={`absolute inset-y-0 right-0 flex transition-transform duration-300 ease-out z-50 pointer-events-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <button onClick={handleEditAction} className="w-16 h-full bg-indigo-600 text-white flex items-center justify-center active:bg-indigo-700">
          <Edit3 className="w-4 h-4" />
        </button>
        <button onClick={handleDeleteAction} className={`w-16 h-full flex items-center justify-center transition-all ${isConfirmingDelete ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
          <span className="text-[8px] font-black uppercase text-center px-1">{isConfirmingDelete ? 'Ok ?' : 'Suppr.'}</span>
        </button>
      </div>

      {/* Contenu de l'item */}
      <div 
        className={`relative flex items-center gap-3 px-3 transition-transform duration-300 ease-out z-10 flex-1 cursor-pointer h-full ${!tpl.isActive ? 'opacity-30 grayscale' : ''}`} 
        style={{ 
          transform: `translateX(${isOpen ? -threshold : 0}px)`,
          borderLeft: `3px solid ${category?.color || '#cbd5e1'}` 
        }} 
        onClick={() => onToggleReveal()}
      >
        <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 border border-slate-100 shadow-sm">
            {tpl.dayOfMonth}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-slate-800 truncate uppercase tracking-tight leading-tight">
            {tpl.comment || 'Sans libellé'}
          </div>
          <div className="text-[7px] font-black text-slate-300 uppercase tracking-[0.1em] mt-0.5">
            Le {tpl.dayOfMonth} du mois
          </div>
        </div>

        <div className="text-right flex flex-col items-end shrink-0">
          <div className={`font-black text-[11px] ${tpl.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'}`}>
            {tpl.type === 'INCOME' ? '+' : '-'}{Math.abs(tpl.amount).toLocaleString('fr-FR')}€
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onStatusToggle(tpl.id); }} 
            className="text-[6px] font-black text-slate-400 uppercase tracking-tighter hover:text-indigo-500"
          >
            {tpl.isActive ? 'Suspendre' : 'Activer'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RecurringManager: React.FC<RecurringManagerProps> = ({ recurringTemplates, categories, onUpdate, totalBalance, month, year, onMonthChange }) => {
  const [editingTpl, setEditingTpl] = useState<RecurringTemplate | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  // Initialisé à vide pour que tout soit fermé par défaut
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLDivElement>(null);
  
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [comment, setComment] = useState('');
  const [day, setDay] = useState('1');

  useEffect(() => {
    if ((showAdd || editingTpl) && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showAdd, editingTpl]);

  const { expenseChartData, totalExpenses, totalIncomes, groupedByCat } = useMemo(() => {
    const activeTemplates = recurringTemplates.filter(t => t.isActive);
    const expenses = activeTemplates.filter(t => t.type === 'EXPENSE');
    const totalE = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalI = activeTemplates.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const chartMap = expenses.reduce((acc, tpl) => {
      const cat = categories.find(c => c.id === tpl.categoryId);
      const catId = cat?.id || 'other';
      if (!acc[catId]) acc[catId] = { name: cat?.name || 'Autre', value: 0, color: cat?.color || '#94a3b8' };
      acc[catId].value += Math.abs(tpl.amount);
      return acc;
    }, {} as Record<string, { name: string, value: number, color: string }>);

    const listMap = recurringTemplates.reduce((acc, tpl) => {
        const catId = tpl.categoryId || 'other';
        if (!acc[catId]) acc[catId] = [];
        acc[catId].push(tpl);
        return acc;
    }, {} as Record<string, RecurringTemplate[]>);

    return { 
      expenseChartData: Object.values(chartMap).sort((a, b) => b.value - a.value), 
      totalExpenses: totalE, totalIncomes: totalI, groupedByCat: listMap
    };
  }, [recurringTemplates, categories]);

  const toggleCat = (catId: string) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.abs(parseFloat(amount.replace(',', '.')));
    if (isNaN(parsedAmount) || !categoryId) return;
    
    const templateData: RecurringTemplate = {
      id: editingTpl?.id || generateId(),
      amount: parsedAmount,
      type, categoryId, comment,
      dayOfMonth: Math.min(31, Math.max(1, parseInt(day))),
      isActive: editingTpl ? editingTpl.isActive : true
    };
    if (editingTpl) onUpdate(recurringTemplates.map(t => t.id === editingTpl.id ? templateData : t));
    else onUpdate([...recurringTemplates, templateData]);
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditingTpl(null); setShowAdd(false); setAmount(''); setCategoryId(''); setComment(''); setDay('1'); setType('EXPENSE');
  };

  return (
    <div className="space-y-6 pb-32 h-full overflow-y-auto no-scrollbar px-1">
      <div className="flex items-center justify-between px-1 mt-4">
        <h2 className="text-xl font-black tracking-tighter text-slate-800 italic uppercase">Flux Fixes</h2>
      </div>

      <div className="bg-emerald-500 p-8 rounded-[40px] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="flex items-center gap-3 mb-2">
          <ArrowUpCircle className="text-emerald-200 w-5 h-5" />
          <span className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.2em]">Revenus fixes</span>
        </div>
        <div className="text-4xl font-black text-white">+{totalIncomes.toLocaleString('fr-FR')}€</div>
      </div>

      <div className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-8">
          <PieChart className="text-indigo-500 w-4 h-4" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Répartition des charges</h3>
        </div>
        <div className="flex flex-col items-center">
          <RecurringPieChart data={expenseChartData} total={totalExpenses} />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-10">
            {expenseChartData.slice(0, 6).map((cat, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100/50">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="px-2 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Détails par catégorie</h3>
          <List className="w-3 h-3 text-slate-300" />
        </div>

        {Object.entries(groupedByCat).map(([catId, templates]) => {
            const category = categories.find(c => c.id === catId);
            // On vérifie si c'est explicitement true, sinon c'est false par défaut
            const isExpanded = !!expandedCats[catId];
            const catTotal = templates.reduce((sum, t) => sum + (t.isActive ? (t.type === 'INCOME' ? t.amount : -t.amount) : 0), 0);

            return (
                <div key={catId} className="bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm transition-all">
                    <button 
                      onClick={() => toggleCat(catId)} 
                      className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm" style={{ backgroundColor: `${category?.color || '#94a3b8'}20`, color: category?.color }}>{category?.icon || '📦'}</div>
                            <div className="flex flex-col text-left">
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 leading-none">{category?.name || 'Autre'}</span>
                                <span className="text-[7px] font-black text-slate-400 uppercase mt-1 tracking-tight">{templates.length} Opérations</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`text-[11px] font-black ${catTotal > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>{catTotal > 0 ? '+' : ''}{catTotal.toLocaleString('fr-FR')}€</span>
                            {isExpanded ? <ChevronDown size={14} className="text-slate-300" /> : <ChevronRight size={14} className="text-slate-300" />}
                        </div>
                    </button>
                    {isExpanded && (
                        <div className="px-3 pb-3 pt-1 space-y-1 animate-in fade-in duration-200">
                            {templates.map(tpl => (
                                <RecurringItem 
                                  key={tpl.id} 
                                  tpl={tpl} 
                                  category={category} 
                                  isOpen={openItemId === tpl.id} 
                                  onToggleReveal={() => setOpenItemId(openItemId === tpl.id ? null : tpl.id)} 
                                  onDelete={(id) => onUpdate(recurringTemplates.filter(t => t.id !== id))} 
                                  onEdit={(t) => { setEditingTpl(t); setType(t.type); setAmount(t.amount.toString()); setCategoryId(t.categoryId); setComment(t.comment || ''); setDay(t.dayOfMonth.toString()); setShowAdd(true); }} 
                                  onStatusToggle={(id) => onUpdate(recurringTemplates.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t))} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            );
        })}

        <div ref={formRef} className="pt-4">
          {showAdd ? (
            <div className={`p-6 rounded-[32px] border shadow-xl animate-in slide-in-from-bottom duration-300 ${editingTpl ? 'bg-indigo-50/30 border-indigo-100' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className={`w-2 h-2 rounded-full ${editingTpl ? 'bg-indigo-600 animate-pulse' : 'bg-slate-400'}`} />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                  {editingTpl ? 'Modifier la programmation' : 'Nouvelle programmation'}
                </h4>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                  <button type="button" onClick={() => setType('EXPENSE')} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400'}`}>Charge Fixe</button>
                  <button type="button" onClick={() => setType('INCOME')} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${type === 'INCOME' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}>Revenu Fixe</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100">
                    <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Montant</label>
                    <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="bg-transparent text-lg font-black w-full outline-none" required />
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100">
                    <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Jour du mois</label>
                    <input type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} className="bg-transparent text-lg font-black w-full outline-none" required />
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100">
                  <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Libellé</label>
                  <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Ex: Loyer, Netflix..." className="bg-transparent text-[11px] font-bold w-full outline-none" />
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 no-scrollbar">
                  {categories.filter(c => c.type === type).map(cat => (
                    <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)} className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${categoryId === cat.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'bg-white border-slate-50'}`}>
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-[7px] font-black uppercase truncate w-full text-center">{cat.name}</span>
                    </button>
                  ))}
                </div>
                <button type="submit" className={`w-full py-5 text-[10px] font-black uppercase text-white rounded-2xl shadow-lg transition-all active:scale-95 ${editingTpl ? 'bg-indigo-600' : 'bg-slate-900'}`}>
                  {editingTpl ? 'Mettre à jour' : 'Enregistrer'}
                </button>
                <button type="button" onClick={cancelEdit} className="w-full text-[9px] font-black uppercase text-slate-400 py-2">Annuler</button>
              </form>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-3 bg-white active:scale-95 transition-all shadow-sm">
              <IconPlus className="w-5 h-5" /> Programmer un nouveau flux
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecurringManager;