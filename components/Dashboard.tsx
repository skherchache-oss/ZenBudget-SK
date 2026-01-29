
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
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, activeAccount, allAccounts, onSwitchAccount, month, year }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse de votre sérénité...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const now = new Date();
  const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year;

  const currentMonthTransactions = useMemo(() => {
    return (transactions || []).filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [transactions, month, year]);

  const currentStatus = useMemo(() => {
    let income = 0;
    let expenses = 0;
    currentMonthTransactions.forEach(t => {
      const tDate = new Date(t.date);
      const isPastOrToday = !isCurrentMonth || tDate.getDate() <= now.getDate();
      if (isPastOrToday) {
        if (t.type === 'INCOME') income += t.amount;
        else expenses += t.amount;
      }
    });
    return { income, expenses, balance: income - expenses };
  }, [currentMonthTransactions, isCurrentMonth, now.getDate()]);

  const projection = useMemo(() => {
    return currentMonthTransactions.reduce((acc, t) => {
      return acc + (t.type === 'INCOME' ? t.amount : -t.amount);
    }, 0);
  }, [currentMonthTransactions]);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthTransactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([id, value]) => {
      const cat = categories.find(c => c.id === id);
      return { name: cat?.name || '?', value, color: cat?.color || '#ccc', icon: cat?.icon || '❓' };
    }).sort((a, b) => b.value - a.value);
  }, [currentMonthTransactions, categories]);

  useEffect(() => {
    const fetchAiAdvice = async () => {
      if (!process.env.API_KEY) {
        setAiAdvice(projection < 0 ? "Attention au découvert prévu." : "Budget équilibré.");
        return;
      }
      setLoadingAdvice(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const expenseTotal = currentMonthTransactions.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
        const prompt = `Analyse très courte pour ${MONTHS_FR[month]}: Revenus ${currentStatus.income}€, Dépenses ${expenseTotal}€, Projection ${projection}€. Conseil 100 car. max.`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setAiAdvice(response.text || "Continuez votre suivi.");
      } catch (err) {
        setAiAdvice("Suivez vos dépenses de près.");
      } finally {
        setLoadingAdvice(false);
      }
    };
    fetchAiAdvice();
  }, [projection]);

  const safetyPercentage = useMemo(() => {
    const totalIncome = currentMonthTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = currentMonthTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    if (totalIncome === 0) return totalExpense > 0 ? 100 : 0;
    return Math.min(100, (totalExpense / totalIncome) * 100);
  }, [currentMonthTransactions]);

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="space-y-3 animate-in fade-in duration-500 max-h-full overflow-hidden flex flex-col">
      {/* Sélecteur de compte compact */}
      <div className="relative px-1 flex items-center justify-between shrink-0">
        <button 
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm active:scale-95 transition-all"
        >
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeAccount.color }} />
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-700">{activeAccount.name}</span>
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        </button>

        {showAccountMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
            <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50">
              {allAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-[9px] font-black uppercase tracking-widest text-gray-500"
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: acc.color }} />
                  {acc.name}
                </button>
              ))}
            </div>
          </>
        )}
        <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Stats</span>
      </div>

      {/* Projection Card Compacte */}
      <div className={`bg-white p-5 rounded-[32px] shadow-sm border shrink-0 transition-all ${projection < 0 ? 'border-red-100 ring-4 ring-red-50/30' : 'border-gray-50'}`}>
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="text-gray-400 text-[9px] font-black uppercase tracking-widest block mb-0.5">Projection fin {MONTHS_FR[month]}</span>
            <div className={`text-4xl font-black tracking-tighter leading-none ${projection >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              {Math.round(projection)}<span className="text-xl ml-0.5">€</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-gray-400 text-[8px] font-black uppercase tracking-widest block mb-0.5">Dépensé</span>
            <div className="text-xl font-black text-slate-800">{safetyPercentage.toFixed(0)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50/50 rounded-2xl border border-gray-100 flex flex-col">
            <span className="text-gray-400 text-[8px] font-black uppercase tracking-widest block mb-0.5">Solde au {now.getDate()}</span>
            <span className={`text-sm font-black ${currentStatus.balance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
              {currentStatus.balance.toLocaleString('fr-FR')}€
            </span>
          </div>
          <div className="p-3 bg-gray-50/50 rounded-2xl border border-gray-100 flex flex-col">
            <span className="text-gray-400 text-[8px] font-black uppercase tracking-widest block mb-0.5">Total Dépenses</span>
            <span className="text-sm font-black text-gray-900">
              {Math.round(currentMonthTransactions.filter(t => t.type === 'EXPENSE').reduce((a,b)=>a+b.amount,0))}€
            </span>
          </div>
        </div>
      </div>

      {/* Chart Miniaturisé */}
      <div className="bg-white p-3 rounded-[32px] shadow-sm border border-gray-50 flex-1 min-h-[140px] relative overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categorySummary}
              cx="50%" cy="50%"
              innerRadius={45} outerRadius={60}
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
            <div className="text-center animate-in zoom-in-95 duration-200">
              <span className="text-lg leading-none">{hoveredCategory.icon}</span>
              <div className="text-[8px] font-black text-indigo-600 uppercase tracking-tight truncate max-w-[60px]">{hoveredCategory.name}</div>
              <div className="text-sm font-black text-gray-900 leading-none">{Math.round(hoveredCategory.value)}€</div>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-[7px] font-black text-gray-300 uppercase tracking-widest block">Catégories</span>
              <span className="text-xs font-black text-gray-400">Total</span>
            </div>
          )}
        </div>
      </div>

      {/* Zen Advisor Compact */}
      <div className="bg-gray-900 text-white p-5 rounded-[32px] shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl" />
        <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
            <h4 className="font-black text-[8px] uppercase tracking-widest text-indigo-400">Zen Advisor</h4>
        </div>
        <p className={`text-[12px] font-medium leading-relaxed ${loadingAdvice ? 'opacity-40 animate-pulse' : 'opacity-100'}`}>
          "{aiAdvice}"
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
