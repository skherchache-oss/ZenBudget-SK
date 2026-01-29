
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
  carryOver: number;
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

const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, activeAccount, allAccounts, onSwitchAccount, month, year, carryOver }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse de votre sérénité...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const currentStats = useMemo(() => {
    let income = 0;
    let expenses = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expenses += t.amount;
    });
    return { income, expenses, balance: carryOver + income - expenses };
  }, [transactions, carryOver]);

  const totalExpenses = currentStats.expenses || 1; // Éviter division par zéro

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
        setAiAdvice(currentStats.balance < 0 ? "Le découvert guette, priorisez les besoins essentiels." : "Votre trajectoire est saine, maintenez ce cap.");
        return;
      }
      setLoadingAdvice(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `ZenBudget Analytique: Report ${carryOver}€, Revenus ${currentStats.income}€, Dépenses ${currentStats.expenses}€. Top dépense: ${categorySummary[0]?.name || 'N/A'}. Conseil financier pro et bienveillant (70 car max).`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setAiAdvice(response.text || "La discipline est la clé de la liberté financière.");
      } catch (err) {
        setAiAdvice("Continuez à piloter votre budget avec précision.");
      } finally {
        setLoadingAdvice(false);
      }
    };
    fetchAiAdvice();
  }, [currentStats.balance, carryOver, month, categorySummary]);

  const usagePercent = useMemo(() => {
    const totalResource = Math.max(0, carryOver) + currentStats.income;
    if (totalResource <= 0) return currentStats.expenses > 0 ? 100 : 0;
    return Math.min(100, (currentStats.expenses / totalResource) * 100);
  }, [currentStats, carryOver]);

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-4 overflow-y-auto no-scrollbar pb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Top Section: Account & Status */}
      <div className="flex items-center justify-between px-1">
        <div className="relative">
          <button 
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="flex items-center gap-2.5 bg-white/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white shadow-sm active:scale-95 transition-all z-[60]"
          >
            <div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{ backgroundColor: activeAccount.color }} />
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-800">{activeAccount.name}</span>
            <svg className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${showAccountMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showAccountMenu && (
            <div className="absolute top-12 left-0 w-48 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 py-2 z-[70] animate-in zoom-in-95 duration-200">
              {allAccounts.map(acc => (
                <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50/50 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                  {acc.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">En direct</span>
        </div>
      </div>

      {/* Main Solde Card */}
      <div className={`relative overflow-hidden p-6 rounded-[32px] border transition-all shadow-xl shadow-slate-200/20 ${currentStats.balance < 0 ? 'bg-red-50/40 border-red-100' : 'bg-white border-slate-50'}`}>
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <span className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] block mb-2">Solde Projeté Fin {MONTHS_FR[month]}</span>
          <div className="flex items-baseline gap-2">
            <h2 className={`text-5xl font-black tracking-tighter leading-none ${currentStats.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
              {Math.round(currentStats.balance).toLocaleString('fr-FR')}
            </h2>
            <span className={`text-2xl font-black ${currentStats.balance >= 0 ? 'text-slate-400' : 'text-red-300'}`}>€</span>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Utilisation du budget</span>
              <span className="text-slate-900">{usagePercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ease-out ${usagePercent > 90 ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="bg-white p-4 rounded-[28px] border border-slate-50 shadow-sm">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Revenus + Report</span>
          <div className="text-lg font-black text-emerald-600">+{(Math.max(0, carryOver) + currentStats.income).toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-4 rounded-[28px] border border-slate-50 shadow-sm text-right">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dépenses Totales</span>
          <div className="text-lg font-black text-slate-900">-{currentStats.expenses.toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      {/* Chart & Detailed Legend */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Répartition Analytique</h3>
          <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">Ce mois</span>
        </div>

        <div className="flex flex-col items-center">
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
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      style={{ outline: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }} 
                    />
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
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block">Total</span>
                  <span className="text-xs font-black text-slate-900">{Math.round(currentStats.expenses)}€</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full space-y-4 mt-2">
            {categorySummary.slice(0, 5).map((cat, idx) => (
              <div key={cat.id} className="group cursor-pointer" onMouseEnter={() => setActiveIndex(idx)} onMouseLeave={() => setActiveIndex(null)}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px]">{cat.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-900">{Math.round(cat.value)}€</span>
                    <span className="text-[8px] font-bold text-slate-400 ml-2">{Math.round(cat.percent)}%</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-700 delay-150" 
                    style={{ backgroundColor: cat.color, width: `${cat.percent}%` }}
                  />
                </div>
              </div>
            ))}
            {categorySummary.length > 5 && (
              <p className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest pt-2">
                + {categorySummary.length - 5} autres catégories
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AI Advisor - Floating Box */}
      <div className="sticky bottom-2 z-30 mx-1">
        <div className="bg-slate-900 text-white p-5 rounded-[32px] shadow-2xl relative overflow-hidden ring-1 ring-white/10">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl" />
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)] animate-pulse" />
            <h4 className="font-black text-[8px] uppercase tracking-[0.3em] text-indigo-400">Zen Financial Intelligence</h4>
          </div>
          <p className={`text-[13px] font-medium leading-relaxed italic ${loadingAdvice ? 'opacity-30' : 'opacity-100'} transition-opacity duration-500`}>
            "{aiAdvice}"
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
