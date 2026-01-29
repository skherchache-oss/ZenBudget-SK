
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
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

const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, activeAccount, allAccounts, onSwitchAccount, month, year, carryOver }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse en cours...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const now = new Date();
  const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year;

  // Stats du mois
  const currentStats = useMemo(() => {
    let income = 0;
    let expenses = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expenses += t.amount;
    });
    return { income, expenses, balance: carryOver + income - expenses };
  }, [transactions, carryOver]);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([id, value]) => {
      const cat = categories.find(c => c.id === id);
      return { name: cat?.name || '?', value, color: cat?.color || '#ccc', icon: cat?.icon || '❓' };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories]);

  useEffect(() => {
    const fetchAiAdvice = async () => {
      if (!process.env.API_KEY) {
        setAiAdvice(currentStats.balance < 0 ? "Attention au découvert prévu." : "Budget bien équilibré.");
        return;
      }
      setLoadingAdvice(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Dash ${MONTHS_FR[month]}: Report ${carryOver}€, Revenus ${currentStats.income}€, Dépenses ${currentStats.expenses}€. Conseil ultra-court 70 car max.`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setAiAdvice(response.text || "Suivez vos dépenses de près.");
      } catch (err) {
        setAiAdvice("Continuez votre suivi rigoureux.");
      } finally {
        setLoadingAdvice(false);
      }
    };
    fetchAiAdvice();
  }, [currentStats.balance, carryOver]);

  const usagePercent = useMemo(() => {
    const totalResource = carryOver + currentStats.income;
    if (totalResource <= 0) return currentStats.expenses > 0 ? 100 : 0;
    return Math.min(100, (currentStats.expenses / totalResource) * 100);
  }, [currentStats, carryOver]);

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-2.5 overflow-hidden">
      {/* Account Switcher Small */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <button 
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-full border border-gray-100 shadow-sm active:scale-95 transition-all relative z-[60]"
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeAccount.color }} />
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-700">{activeAccount.name}</span>
          <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        </button>

        {showAccountMenu && (
          <div className="absolute top-10 left-0 w-36 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[70] animate-in zoom-in-95">
            {allAccounts.map(acc => (
              <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: acc.color }} />
                {acc.name}
              </button>
            ))}
          </div>
        )}
        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Aperçu</span>
      </div>

      {/* Primary Card - Dense */}
      <div className={`bg-white p-4 rounded-[24px] shadow-sm border shrink-0 transition-colors ${currentStats.balance < 0 ? 'bg-red-50/20 border-red-100' : 'border-slate-50'}`}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-0.5">Projection fin {MONTHS_FR[month]}</span>
            <div className={`text-3xl font-black tracking-tighter leading-none ${currentStats.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
              {Math.round(currentStats.balance)}<span className="text-lg ml-0.5">€</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-0.5">Utilisation</span>
            <div className="text-lg font-black text-slate-800">{usagePercent.toFixed(0)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-50">
          <div>
            <span className="text-slate-400 text-[7px] font-black uppercase tracking-widest block mb-0.5">Report</span>
            <span className="text-xs font-black text-indigo-500">{Math.round(carryOver)}€</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[7px] font-black uppercase tracking-widest block mb-0.5">Total Dépenses</span>
            <span className="text-xs font-black text-slate-900">{Math.round(currentStats.expenses)}€</span>
          </div>
        </div>
      </div>

      {/* Chart Section - Resizable */}
      <div className="bg-white p-2 rounded-[24px] shadow-sm border border-slate-50 flex-1 min-h-[140px] relative overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categorySummary}
              cx="50%" cy="50%"
              innerRadius={42} outerRadius={58}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {categorySummary.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none', cursor: 'pointer', opacity: activeIndex === null || activeIndex === index ? 1 : 0.4 }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredCategory ? (
            <div className="text-center animate-in zoom-in-90 duration-200">
              <span className="text-lg leading-none">{hoveredCategory.icon}</span>
              <div className="text-[7px] font-black text-indigo-600 uppercase tracking-tighter truncate max-w-[50px]">{hoveredCategory.name}</div>
              <div className="text-xs font-black text-slate-900">{Math.round(hoveredCategory.value)}€</div>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest block">Flux</span>
              <span className="text-[8px] font-black text-slate-400">Mensuel</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Advisor - Mini */}
      <div className="bg-slate-900 text-white p-3.5 rounded-[24px] shadow-lg shrink-0 relative overflow-hidden">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
          <h4 className="font-black text-[7px] uppercase tracking-[0.3em] text-indigo-400">Zen Advisor</h4>
        </div>
        <p className={`text-[11px] font-medium leading-snug italic ${loadingAdvice ? 'opacity-30' : 'opacity-100'}`}>
          "{aiAdvice}"
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
