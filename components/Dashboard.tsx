
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
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse zen...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

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
        setAiAdvice(currentStats.balance < 0 ? "Vigilance sur le solde de fin de mois." : "Gestion sereine prévue.");
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
  }, [currentStats.balance, carryOver, month]);

  const usagePercent = useMemo(() => {
    const totalResource = Math.max(0, carryOver) + currentStats.income;
    if (totalResource <= 0) return currentStats.expenses > 0 ? 100 : 0;
    return Math.min(100, (currentStats.expenses / totalResource) * 100);
  }, [currentStats, carryOver]);

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-3 overflow-hidden animate-in fade-in duration-500">
      {/* Account Switcher */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <button 
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm active:scale-95 transition-all relative z-[60]"
        >
          <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ backgroundColor: activeAccount.color }} />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">{activeAccount.name}</span>
          <svg className={`w-3 h-3 text-slate-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        </button>

        {showAccountMenu && (
          <div className="absolute top-10 left-0 w-40 bg-white rounded-2xl shadow-xl border border-slate-50 py-1.5 z-[70] animate-in zoom-in-95 duration-200">
            {allAccounts.map(acc => (
              <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-500">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                {acc.name}
              </button>
            ))}
          </div>
        )}
        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Cockpit</span>
      </div>

      {/* Main Stats Card */}
      <div className={`bg-white p-5 rounded-[28px] shadow-sm border shrink-0 transition-all ${currentStats.balance < 0 ? 'bg-red-50/20 border-red-100' : 'border-slate-50'}`}>
        <div className="flex justify-between items-end mb-5">
          <div>
            <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-1">Projection fin {MONTHS_FR[month]}</span>
            <div className={`text-4xl font-black tracking-tighter leading-none ${currentStats.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
              {Math.round(currentStats.balance).toLocaleString('fr-FR')}<span className="text-xl ml-1">€</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-1">Usage Budget</span>
            <div className="text-xl font-black text-slate-800">{usagePercent.toFixed(0)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
            <span className="text-slate-400 text-[7px] font-black uppercase tracking-widest block mb-0.5">Reporté</span>
            <span className={`text-xs font-black ${carryOver >= 0 ? 'text-indigo-500' : 'text-red-400'}`}>{Math.round(carryOver).toLocaleString('fr-FR')}€</span>
          </div>
          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50 text-right">
            <span className="text-slate-400 text-[7px] font-black uppercase tracking-widest block mb-0.5">Dépenses</span>
            <span className="text-xs font-black text-slate-900">{Math.round(currentStats.expenses).toLocaleString('fr-FR')}€</span>
          </div>
        </div>
      </div>

      {/* Chart - Optimized height */}
      <div className="bg-white p-3 rounded-[28px] shadow-sm border border-slate-50 flex-1 min-h-[140px] relative overflow-hidden transition-transform">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categorySummary}
              cx="50%" cy="50%"
              innerRadius={45} outerRadius={62}
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
            <div className="text-center animate-in zoom-in-90 duration-300">
              <span className="text-2xl leading-none">{hoveredCategory.icon}</span>
              <div className="text-[8px] font-black text-indigo-600 uppercase tracking-tighter truncate max-w-[60px]">{hoveredCategory.name}</div>
              <div className="text-sm font-black text-slate-900 leading-none">{Math.round(hoveredCategory.value)}€</div>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block">Analyse</span>
              <span className="text-[10px] font-black text-slate-400">Mensuelle</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Advisor - Fixed at bottom */}
      <div className="bg-slate-900 text-white p-4 rounded-[28px] shadow-lg shrink-0 relative overflow-hidden ring-4 ring-indigo-50/30">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
          <h4 className="font-black text-[7px] uppercase tracking-[0.3em] text-indigo-400">Zen AI Assistant</h4>
        </div>
        <p className={`text-[12px] font-medium leading-snug italic ${loadingAdvice ? 'opacity-30' : 'opacity-100'} transition-opacity`}>
          "{aiAdvice}"
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
