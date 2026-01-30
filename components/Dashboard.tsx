
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { GoogleGenAI } from "@google/genai";
import { IconExport } from './Icons';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  activeAccount: BudgetAccount;
  allAccounts: BudgetAccount[];
  onSwitchAccount: (id: string) => void;
  month: number;
  year: number;
  onViewTransactions: () => void;
  checkingAccountBalance: number;
  availableBalance: number;
  projectedBalance: number;
  carryOver: number;
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 4} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, categories, activeAccount, allAccounts, onSwitchAccount, month, year, checkingAccountBalance, availableBalance, projectedBalance, carryOver 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse en cours...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const stats = useMemo(() => {
    let income = 0, expenses = 0, fixed = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else {
        expenses += t.amount;
        if (t.isRecurring) fixed += t.amount;
      }
    });
    return { 
      income, 
      expenses, 
      fixed, 
      variable: expenses - fixed, 
      net: income - expenses 
    };
  }, [transactions]);

  useEffect(() => {
    const fetchAiAdvice = async () => {
      if (!process.env.API_KEY) {
        setAiAdvice(availableBalance < 100 ? "Prévoyez une marge pour les imprévus." : "Votre disponible est confortable, savourez l'instant.");
        return;
      }
      setLoadingAdvice(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `ZenBudget: Bancaire ${checkingAccountBalance}€, Disponible ${availableBalance}€, Fixes ${stats.fixed}€, Variables ${stats.variable}€. Donne 1 conseil bienveillant et zen très court (50 car max, français).`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setAiAdvice(response.text || "La clarté apporte la sérénité.");
      } catch (err) { setAiAdvice("Observez vos flux sans jugement."); }
      finally { setLoadingAdvice(false); }
    };
    fetchAiAdvice();
  }, [availableBalance, checkingAccountBalance, stats]);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    const total = stats.expenses || 1;
    return Object.entries(map).map(([id, value]) => {
      const cat = categories.find(c => c.id === id);
      return { id, name: cat?.name || 'Autres', value, color: cat?.color || '#94a3b8', icon: cat?.icon || '📦', percent: (value / total) * 100 };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories, stats.expenses]);

  const handleExportCSV = () => {
    const s = ";"; 
    const f = (n: number) => n.toFixed(2).replace('.', ','); 
    const rows = [];
    rows.push(["ZENBUDGET - EXPORT CSV"]);
    rows.push([`Compte: ${activeAccount.name}${s}Periode: ${MONTHS_FR[month]} ${year}`]);
    rows.push([]);
    rows.push(["SECTION: SYNTHESE DES SOLDES"]);
    rows.push([`Report mois precedent${s}${f(carryOver)} €`]);
    rows.push([`Solde Bancaire (Actuel)${s}${f(checkingAccountBalance)} €`]);
    rows.push([`Disponible Reel (Apres charges)${s}${f(availableBalance)} €`]);
    rows.push([`Projection Fin de Mois${s}${f(projectedBalance)} €`]);
    rows.push([]);
    rows.push(["SECTION: ANALYSE DES CHARGES"]);
    rows.push([`Charges Fixes (Abonnements...)${s}${f(stats.fixed)} €`]);
    rows.push([`Depenses Variables (Courses...)${s}${f(stats.variable)} €`]);
    rows.push([]);
    rows.push(["SECTION: JOURNAL DES OPERATIONS"]);
    rows.push([`DATE${s}CATEGORIE${s}TYPE${s}MONTANT${s}SOLDE CUMULE${s}FIXE${s}NOTES`]);
    
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = carryOver;
    sorted.forEach(t => {
      const catName = categories.find(c => c.id === t.categoryId)?.name || 'Inconnue';
      const amt = t.type === 'INCOME' ? t.amount : -t.amount;
      running += amt;
      const note = (t.comment || '').replace(/;/g, ',').replace(/"/g, "'");
      rows.push([`${new Date(t.date).toLocaleDateString('fr-FR')}${s}${catName}${s}${t.type}${s}${f(t.amount)} €${s}${f(running)} €${s}${t.isRecurring?'OUI':'NON'}${s}"${note}"`]);
    });
    
    const blob = new Blob(["\uFEFF" + rows.map(r => r.join('')).join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ZenBudget_${activeAccount.name}_${MONTHS_FR[month]}.csv`;
    link.click();
  };

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-7 overflow-y-auto no-scrollbar pb-24 px-1 animate-in fade-in duration-700">
      
      {/* 1. Header Zen & Actions */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Bienvenue ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Votre horizon financier</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportCSV} 
            title="Export CSV"
            className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-400 active:scale-90 transition-all hover:text-indigo-600"
          >
            <IconExport className="w-4 h-4" />
          </button>
          <div className="relative">
            <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-all">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeAccount.color }} />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{activeAccount.name}</span>
            </button>
            {showAccountMenu && (
              <div className="absolute top-14 right-0 w-48 bg-white rounded-[24px] shadow-2xl border border-slate-100 py-2 z-[70] animate-in zoom-in-95 duration-200">
                {allAccounts.map(acc => (
                  <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-[10px] font-black uppercase text-slate-600">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} /> {acc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Solde Bancaire Card (Le Référentiel) */}
      <div className="bg-slate-900 p-8 rounded-[48px] shadow-2xl relative overflow-hidden ring-1 ring-white/10 group">
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] block mb-2 opacity-80">Solde Bancaire</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter text-white leading-none">
                {Math.round(checkingAccountBalance).toLocaleString('fr-FR')}
              </span>
              <span className="text-2xl font-black text-slate-500">€</span>
            </div>
          </div>
          <div className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-md">
            <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Temps réel</span>
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-[60px] pointer-events-none group-hover:bg-indigo-500/30 transition-colors" />
      </div>

      {/* 3. Disponible Réel & Fin de mois (L'Action) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-600 p-6 rounded-[36px] shadow-xl shadow-indigo-100 flex flex-col gap-3 relative overflow-hidden">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest block relative z-10">Disponible Réel</span>
          <div className="relative z-10">
            <div className="text-2xl font-black text-white leading-none mb-1">{Math.round(availableBalance).toLocaleString('fr-FR')}€</div>
            <p className="text-[7px] font-black text-indigo-200 uppercase tracking-tighter opacity-70">Après charges fixes</p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
        </div>

        <div className="bg-white p-6 rounded-[36px] border border-slate-100 shadow-sm flex flex-col gap-3">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block">Fin de mois</span>
          <div>
            <div className={`text-2xl font-black leading-none mb-1 ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{Math.round(projectedBalance).toLocaleString('fr-FR')}€</div>
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Projection finale</p>
          </div>
        </div>
      </div>

      {/* 4. Répartition Fixes vs Variables */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[36px] border border-slate-50 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-xl shrink-0">⚡️</div>
          <div className="min-w-0">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Fixes</span>
            <div className="text-sm font-black text-slate-800 truncate">{Math.round(stats.fixed).toLocaleString('fr-FR')}€</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[36px] border border-slate-50 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-xl shrink-0">🌊</div>
          <div className="min-w-0">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Variables</span>
            <div className="text-sm font-black text-slate-800 truncate">{Math.round(stats.variable).toLocaleString('fr-FR')}€</div>
          </div>
        </div>
      </div>

      {/* 5. Conseil AI Banner */}
      <div className="bg-slate-100 p-6 rounded-[40px] flex items-center gap-5 border border-white">
        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl shrink-0 animate-pulse">🧘</div>
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-medium leading-tight text-slate-600 italic transition-opacity duration-700 ${loadingAdvice ? 'opacity-30' : 'opacity-100'}`}>
            "{aiAdvice}"
          </p>
        </div>
      </div>

      {/* 6. Graphique & Catégories */}
      <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Postes de dépenses</h3>
          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl">Analyses</span>
        </div>
        
        <div className="w-full h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                {...({
                  activeIndex: activeIndex === null ? undefined : activeIndex, 
                  activeShape: renderActiveShape, 
                  data: categorySummary, 
                  cx: "50%", cy: "50%", 
                  innerRadius: 60, outerRadius: 75, 
                  paddingAngle: 5, dataKey: "value", 
                  stroke: "none", 
                  onMouseEnter: (_: any, idx: number) => setActiveIndex(idx), 
                  onMouseLeave: () => setActiveIndex(null)
                } as any)}
              >
                {categorySummary.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.color} style={{ outline: 'none' }} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hoveredCategory ? (
              <div className="text-center animate-in zoom-in duration-300">
                <span className="text-3xl">{hoveredCategory.icon}</span>
                <div className="text-[10px] font-black text-slate-900 uppercase mt-1">{Math.round(hoveredCategory.percent)}%</div>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[9px] font-black text-slate-300 uppercase block tracking-tighter">Sorties</span>
                <span className="text-lg font-black text-slate-900">{Math.round(stats.expenses).toLocaleString('fr-FR')}€</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-50">
          {categorySummary.length > 0 ? categorySummary.map((cat, idx) => (
            <div 
              key={cat.id} 
              className={`flex items-center gap-4 p-4 rounded-[28px] transition-all ${activeIndex === idx ? 'bg-slate-50 scale-[1.02]' : 'hover:bg-slate-50/50'}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-black text-slate-700 uppercase tracking-tight truncate">{cat.name}</span>
                  <span className="text-[12px] font-black text-slate-900">{Math.round(cat.value).toLocaleString('fr-FR')}€</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                </div>
              </div>
            </div>
          )) : (
            <div className="py-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Aucune dépense ce mois-ci</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
