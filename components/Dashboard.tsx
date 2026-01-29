
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { GoogleGenAI } from "@google/genai";

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  activeAccount: BudgetAccount;
  allAccounts: BudgetAccount[];
  onSwitchAccount: (id: string) => void;
  month: number;
  year: number;
  onViewTransactions: () => void;
  balanceToday: number;
  projectedBalance: number;
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, activeAccount, allAccounts, onSwitchAccount, month, year, balanceToday, projectedBalance }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse de votre sérénité...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const currentMonthStats = useMemo(() => {
    let income = 0;
    let expenses = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expenses += t.amount;
    });
    return { income, expenses };
  }, [transactions]);

  const totalExpenses = currentMonthStats.expenses || 1;

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([id, value]) => {
      const cat = categories.find(c => c.id === id);
      return { 
        id,
        name: cat?.name || 'Autres', 
        value, 
        color: cat?.color || '#94a3b8', 
        icon: cat?.icon || '📦',
        percent: (value / totalExpenses) * 100
      };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories, totalExpenses]);

  useEffect(() => {
    const fetchAiAdvice = async () => {
      if (!process.env.API_KEY) {
        setAiAdvice(projectedBalance < 0 ? "Prudence : vos dépenses projetées dépassent vos revenus. Un ajustement est conseillé." : "Gestion exemplaire. Votre budget de fin de mois est sécurisé.");
        return;
      }
      setLoadingAdvice(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `ZenBudget Analysis: Real Balance Today ${balanceToday}€, Projected End of Month ${projectedBalance}€. Monthly Income ${currentMonthStats.income}€, Monthly Expenses ${currentMonthStats.expenses}€. Provide 1 short financial advice (max 80 chars, French).`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setAiAdvice(response.text || "La discipline financière est la clé de la liberté.");
      } catch (err) {
        setAiAdvice("Pilotez vos flux avec précision pour une sérénité totale.");
      } finally {
        setLoadingAdvice(false);
      }
    };
    fetchAiAdvice();
  }, [projectedBalance, balanceToday, currentMonthStats]);

  const usagePercent = useMemo(() => {
    const totalResource = Math.max(0, projectedBalance - currentMonthStats.income + currentMonthStats.expenses);
    if (totalResource <= 0) return currentMonthStats.expenses > 0 ? 100 : 0;
    return Math.min(100, (currentMonthStats.expenses / totalResource) * 100);
  }, [currentMonthStats, projectedBalance]);

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 0. Sélecteur de Compte */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="relative">
          <button 
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="flex items-center gap-2.5 bg-white/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white shadow-sm active:scale-95 transition-all z-[60]"
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeAccount.color }} />
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-800">{activeAccount.name}</span>
            <svg className={`w-3 h-3 text-slate-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showAccountMenu && (
            <div className="absolute top-12 left-0 w-48 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-100 py-2 z-[70] animate-in zoom-in-95 duration-200">
              {allAccounts.map(acc => (
                <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50/50 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                  {acc.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 1. BLOC SOLDES (Anti-rognage) */}
      <div className={`relative overflow-hidden p-6 rounded-[40px] border transition-all shadow-xl shadow-slate-200/20 shrink-0 ${projectedBalance < 0 ? 'bg-red-50/40 border-red-100' : 'bg-white border-slate-50'}`}>
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <span className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] block mb-2">Disponible Aujourd'hui</span>
          <div className="flex items-baseline gap-2 mb-6">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none text-slate-900 truncate">
              {Math.round(balanceToday).toLocaleString('fr-FR')}
            </h2>
            <span className="text-2xl font-black text-slate-300 shrink-0">€</span>
          </div>
          
          <div className="grid grid-cols-2 gap-6 pt-5 border-t border-slate-50/50">
            <div>
               <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-1.5">Fin de mois ({MONTHS_FR[month]})</span>
               <div className={`text-xl font-black leading-none ${projectedBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                 {Math.round(projectedBalance).toLocaleString('fr-FR')}€
               </div>
            </div>
            <div className="text-right">
               <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-1.5">Consommation</span>
               <div className="text-xl font-black text-slate-900 leading-none">
                 {usagePercent.toFixed(0)}%
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BLOC FLUX (Entrées / Sorties) */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-[28px] border border-slate-50 shadow-sm">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Total Entrées</span>
          <div className="text-xl font-black text-emerald-600 truncate">+{currentMonthStats.income.toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[28px] border border-slate-50 shadow-sm text-right">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Total Sorties</span>
          <div className="text-xl font-black text-slate-900 truncate">-{currentMonthStats.expenses.toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      {/* 3. ASSISTANT ZEN AI (Position stratégique sous les flux) */}
      <div className="bg-slate-900 text-white p-5 rounded-[28px] shadow-2xl relative overflow-hidden ring-1 ring-white/10 mx-1 shrink-0 min-h-[100px] flex flex-col justify-center">
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl" />
        <div className="flex items-center gap-2.5 mb-2 relative z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)] animate-pulse" />
          <h4 className="font-black text-[8px] uppercase tracking-[0.3em] text-indigo-400">Zen Intelligence</h4>
        </div>
        <p className={`text-[12px] font-medium leading-relaxed italic relative z-10 ${loadingAdvice ? 'opacity-30' : 'opacity-100'} transition-opacity duration-500`}>
          "{aiAdvice}"
        </p>
      </div>

      {/* 4. GRAPHIQUE ANALYTIQUE */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm space-y-6 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Répartition du mois</h3>
          <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">Visuel</span>
        </div>

        <div className="w-full h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                activeIndex={activeIndex === null ? undefined : activeIndex}
                activeShape={renderActiveShape}
                data={categorySummary}
                cx="50%" cy="50%"
                innerRadius={62} outerRadius={78}
                paddingAngle={6}
                dataKey="value"
                stroke="none"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {categorySummary.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hoveredCategory ? (
              <div className="text-center animate-in zoom-in-90 duration-300">
                <span className="text-3xl leading-none">{hoveredCategory.icon}</span>
                <div className="text-[10px] font-black text-slate-900 mt-1">{Math.round(hoveredCategory.percent)}%</div>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block">Sorties</span>
                <span className="text-sm font-black text-slate-900">{Math.round(currentMonthStats.expenses)}€</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. DÉTAIL PAR CATÉGORIE */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm shrink-0">
        <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-5">
           <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Détail par catégorie</h4>
           <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{categorySummary.length} postes</span>
        </div>
        
        <div className="space-y-6">
          {categorySummary.length > 0 ? categorySummary.map((cat, idx) => (
            <div key={cat.id} className="group cursor-pointer" onMouseEnter={() => setActiveIndex(idx)} onMouseLeave={() => setActiveIndex(null)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-lg border border-slate-100">{cat.icon}</div>
                  <span className="text-[11px] font-bold text-slate-800 truncate max-w-[140px] uppercase tracking-tight">{cat.name}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-black text-slate-900">{Math.round(cat.value)}€</span>
                  <span className="text-[9px] font-bold text-slate-400 ml-2">{Math.round(cat.percent)}%</span>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ backgroundColor: cat.color, width: `${cat.percent}%` }} />
              </div>
            </div>
          )) : (
            <div className="py-12 text-center flex flex-col items-center gap-2 opacity-30 grayscale">
              <span className="text-3xl">📊</span>
              <div className="text-[10px] font-black uppercase tracking-widest italic">Aucune donnée</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
