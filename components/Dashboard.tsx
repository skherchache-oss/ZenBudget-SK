
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
  checkingAccountBalance: number;
  availableBalance: number;
  projectedBalance: number;
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
  transactions, categories, activeAccount, allAccounts, onSwitchAccount, month, year, checkingAccountBalance, availableBalance, projectedBalance 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse zen...");
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
    return { income, expenses, fixed, variable: expenses - fixed };
  }, [transactions]);

  useEffect(() => {
    const fetchAiAdvice = async () => {
      if (!process.env.API_KEY) {
        setAiAdvice(projectedBalance < 0 ? "Attention au solde projeté fin de mois." : "Gestion sereine ce mois-ci.");
        return;
      }
      setLoadingAdvice(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `ZenBudget: Compte courant ${checkingAccountBalance}€, Fin de mois ${projectedBalance}€, Disponible ${availableBalance}€. Fixes ${stats.fixed}€. Donne 1 conseil zen très court (50 car max, français).`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setAiAdvice(response.text || "La discipline offre la liberté.");
      } catch (err) { setAiAdvice("Observez vos flux sans jugement."); }
      finally { setLoadingAdvice(false); }
    };
    fetchAiAdvice();
  }, [projectedBalance, checkingAccountBalance, availableBalance, stats]);

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

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-24 px-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Account Switcher */}
      <div className="flex items-center justify-between shrink-0">
        <div className="relative">
          <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="flex items-center gap-2.5 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-all">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeAccount.color }} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">{activeAccount.name}</span>
            <svg className={`w-3 h-3 text-slate-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showAccountMenu && (
            <div className="absolute top-12 left-0 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[70] animate-in zoom-in-95 duration-200">
              {allAccounts.map(acc => (
                <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} /> {acc.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 1. LES 3 CHIFFRES CLÉS */}
      <div className="grid grid-cols-1 gap-4 shrink-0">
        {/* Compte courant (RÉEL) */}
        <div className="bg-slate-900 p-7 rounded-[40px] shadow-2xl relative overflow-hidden ring-1 ring-white/10">
          <div className="relative z-10">
            <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] block mb-1">Compte courant</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter text-white leading-none">{Math.round(checkingAccountBalance).toLocaleString('fr-FR')}</span>
              <span className="text-2xl font-black text-slate-600">€</span>
            </div>
          </div>
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Projections Secondaires */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-2">Disponible réel</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black leading-none ${availableBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{Math.round(availableBalance).toLocaleString('fr-FR')}</span>
              <span className="text-xs font-black text-slate-300">€</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-2">Fin de mois ({MONTHS_FR[month]})</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black leading-none ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{Math.round(projectedBalance).toLocaleString('fr-FR')}</span>
              <span className="text-xs font-black text-slate-300">€</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BLOCS FLUX & CHARGES (MÊME TAILLE) */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Entrées</span>
          <div className="text-lg font-black text-emerald-600">+{stats.income.toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm text-right">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sorties</span>
          <div className="text-lg font-black text-slate-900">-{stats.expenses.toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fixes</span>
          <div className="text-lg font-black text-indigo-900">{stats.fixed.toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm text-right">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Variables</span>
          <div className="text-lg font-black text-slate-600">{stats.variable.toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      {/* 3. CONSEIL AI */}
      <div className="bg-indigo-600 text-white p-6 rounded-[32px] shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[90px]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <h4 className="font-black text-[9px] uppercase tracking-[0.3em] text-indigo-200">Conseil Zen</h4>
        </div>
        <p className={`text-[13px] font-medium italic text-indigo-50 leading-tight transition-opacity ${loadingAdvice ? 'opacity-30' : 'opacity-100'}`}>"{aiAdvice}"</p>
      </div>

      {/* 4. GRAPHIQUE */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm shrink-0">
        <div className="w-full h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie activeIndex={activeIndex === null ? undefined : activeIndex} activeShape={renderActiveShape} data={categorySummary} cx="50%" cy="50%" innerRadius={60} outerRadius={75} paddingAngle={5} dataKey="value" stroke="none" onMouseEnter={(_, idx) => setActiveIndex(idx)} onMouseLeave={() => setActiveIndex(null)}>
                {categorySummary.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.color} style={{ outline: 'none' }} />)}
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
                <span className="text-[8px] font-black text-slate-300 uppercase block">Dépenses</span>
                <span className="text-sm font-black text-slate-900">{Math.round(stats.expenses)}€</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
