
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

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, 
  categories, 
  activeAccount, 
  allAccounts, 
  onSwitchAccount, 
  month, 
  year, 
  balanceToday, 
  projectedBalance 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse zen en cours...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const currentMonthStats = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let fixedExpenses = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') {
        income += t.amount;
      } else {
        expenses += t.amount;
        if (t.isRecurring) fixedExpenses += t.amount;
      }
    });
    return { income, expenses, fixedExpenses, variableExpenses: expenses - fixedExpenses };
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
        setAiAdvice(projectedBalance < 0 
          ? "Attention : votre solde projeté fin de mois est négatif. Analysez vos sorties." 
          : "Gestion sereine : votre budget est équilibré pour la fin de ce cycle.");
        return;
      }
      setLoadingAdvice(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `ZenBudget Financial Assistant: Today's real balance ${balanceToday}€. Selected month end projected balance ${projectedBalance}€. Current month income ${currentMonthStats.income}€, fixed expenses ${currentMonthStats.fixedExpenses}€, variable expenses ${currentMonthStats.variableExpenses}€. Provide 1 super-short financial tip (70 characters max, in French).`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setAiAdvice(response.text || "La discipline financière offre la liberté.");
      } catch (err) {
        setAiAdvice("Observez vos flux sans jugement et ajustez avec sagesse.");
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
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-24 px-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Sélecteur de Compte */}
      <div className="flex items-center justify-between shrink-0">
        <div className="relative">
          <button 
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="flex items-center gap-2.5 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-all"
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeAccount.color }} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">{activeAccount.name}</span>
            <svg className={`w-3 h-3 text-slate-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showAccountMenu && (
            <div className="absolute top-12 left-0 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[70] animate-in zoom-in-95 duration-200">
              {allAccounts.map(acc => (
                <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                  {acc.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 1. BLOC SOLDES */}
      <div className={`relative overflow-visible p-7 rounded-[40px] border transition-all shadow-xl shadow-slate-200/20 shrink-0 ${projectedBalance < 0 ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-50'}`}>
        <div className="relative z-10 flex flex-col gap-6">
          <div className="space-y-1">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] block">Cash aujourd'hui</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter text-slate-900 leading-none">
                {Math.round(balanceToday).toLocaleString('fr-FR')}
              </span>
              <span className="text-2xl font-black text-slate-300">€</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
            <div className="space-y-1">
               <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block">Fin de mois ({MONTHS_FR[month]})</span>
               <div className={`text-2xl font-black leading-none ${projectedBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                 {Math.round(projectedBalance).toLocaleString('fr-FR')}€
               </div>
            </div>
            <div className="text-right space-y-1">
               <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block">Consommation</span>
               <div className="text-2xl font-black text-slate-900 leading-none">
                 {usagePercent.toFixed(0)}%
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BLOC FLUX DÉTAILLÉ */}
      <div className="space-y-4 shrink-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-[28px] border border-slate-50 shadow-sm">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Entrées du mois</span>
            <div className="text-xl font-black text-emerald-600">+{currentMonthStats.income.toLocaleString('fr-FR')}€</div>
          </div>
          <div className="bg-white p-5 rounded-[28px] border border-slate-50 shadow-sm text-right">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sorties du mois</span>
            <div className="text-xl font-black text-slate-900">-{currentMonthStats.expenses.toLocaleString('fr-FR')}€</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-indigo-50/50 p-4 rounded-[24px] border border-indigo-100/40">
            <span className="text-[7px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-1">Charges Fixes</span>
            <div className="text-sm font-black text-indigo-900">{currentMonthStats.fixedExpenses.toLocaleString('fr-FR')}€</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-[24px] border border-slate-200/40 text-right">
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Charges Variables</span>
            <div className="text-sm font-black text-slate-900">{currentMonthStats.variableExpenses.toLocaleString('fr-FR')}€</div>
          </div>
        </div>
      </div>

      {/* 3. ASSISTANT AI */}
      <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-2xl h-auto min-h-[100px] flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,1)] animate-pulse" />
          <h4 className="font-black text-[9px] uppercase tracking-[0.3em] text-indigo-400">Conseil Zen</h4>
        </div>
        <p className={`text-[13px] font-medium italic text-indigo-50 leading-relaxed transition-opacity ${loadingAdvice ? 'opacity-30' : 'opacity-100'}`}>
          "{aiAdvice}"
        </p>
      </div>

      {/* 4. GRAPHIQUE */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm shrink-0">
        <div className="w-full h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                activeIndex={activeIndex === null ? undefined : activeIndex}
                activeShape={renderActiveShape}
                data={categorySummary}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={75}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {categorySummary.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hoveredCategory ? (
              <div className="text-center animate-in zoom-in">
                <span className="text-3xl leading-none">{hoveredCategory.icon}</span>
                <div className="text-[10px] font-black text-slate-900 mt-1">{Math.round(hoveredCategory.percent)}%</div>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[8px] font-black text-slate-300 uppercase block">Sorties</span>
                <span className="text-sm font-black text-slate-900">{Math.round(currentMonthStats.expenses)}€</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. DÉTAILS CATÉGORIES */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm shrink-0">
        <div className="space-y-6">
          {categorySummary.length > 0 ? categorySummary.map((cat, idx) => (
            <div key={cat.id} onMouseEnter={() => setActiveIndex(idx)} onMouseLeave={() => setActiveIndex(null)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-lg">{cat.icon}</div>
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{cat.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-black text-slate-900">{Math.round(cat.value)}€</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ backgroundColor: cat.color, width: `${cat.percent}%` }} />
              </div>
            </div>
          )) : (
            <div className="py-8 text-center opacity-30 italic text-[10px] uppercase font-black">Aucune donnée ce mois</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
