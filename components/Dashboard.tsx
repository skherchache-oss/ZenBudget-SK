
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
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse de votre sérénité financière...");
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
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        setAiAdvice(projection < 0 ? "Attention au découvert prévu." : "Votre budget semble équilibré.");
        return;
      }
      setLoadingAdvice(true);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const expenseTotal = currentMonthTransactions.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
        const incomeTotal = currentMonthTransactions.filter(t => t.type === 'INCOME').reduce((a, b) => a + b.amount, 0);
        const prompt = `Analyse courte pour ${MONTHS_FR[month]}: Revenus ${incomeTotal}€, Dépenses ${expenseTotal}€, Projection ${projection}€. Conseil bienveillant max 140 car.`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setAiAdvice(response.text || "Continuez votre suivi rigoureux.");
      } catch (err) {
        setAiAdvice("Continuez à suivre vos dépenses de près.");
      } finally {
        setLoadingAdvice(false);
      }
    };
    fetchAiAdvice();
  }, [projection, categorySummary.length]);

  const safetyPercentage = useMemo(() => {
    const totalIncome = currentMonthTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = currentMonthTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    if (totalIncome === 0) return totalExpense > 0 ? 100 : 0;
    return Math.min(100, (totalExpense / totalIncome) * 100);
  }, [currentMonthTransactions]);

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="relative px-1 flex items-center justify-between">
        <button 
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm active:scale-95 transition-all"
        >
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeAccount.color }} />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">{activeAccount.name}</span>
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        </button>

        {showAccountMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
            <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in zoom-in-95 duration-200">
              {allAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${acc.id === activeAccount.id ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${acc.id === activeAccount.id ? 'text-indigo-600' : 'text-gray-500'}`}>{acc.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tableau de bord</span>
        </div>
      </div>

      <div className={`bg-white p-7 rounded-[40px] shadow-sm border transition-all ${projection < 0 ? 'border-red-100 ring-8 ring-red-50/50' : 'border-gray-50'}`}>
        <div className="mb-8">
          <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest block mb-1">Projection fin {MONTHS_FR[month]}</span>
          <div className={`text-6xl font-black tracking-tighter leading-none ${projection >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {Math.round(projection)}<span className="text-3xl ml-1">€</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50/50 rounded-3xl border border-gray-100">
            <span className="text-gray-400 text-[9px] font-black uppercase tracking-widest block mb-1">Solde au {now.getDate()}</span>
            <span className={`text-lg font-black ${currentStatus.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {currentStatus.balance.toLocaleString('fr-FR')}€
            </span>
          </div>
          <div className="p-4 bg-gray-50/50 rounded-3xl border border-gray-100">
            <span className="text-gray-400 text-[9px] font-black uppercase tracking-widest block mb-1">Dépensé</span>
            <span className="text-lg font-black text-gray-900">{safetyPercentage.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-50">
        <div className="h-52 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categorySummary}
                cx="50%" cy="50%"
                innerRadius={65} outerRadius={85}
                paddingAngle={5}
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
              <>
                <span className="text-2xl mb-1">{hoveredCategory.icon}</span>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{hoveredCategory.name}</span>
                <span className="text-xl font-black text-gray-900">{Math.round(hoveredCategory.value)}€</span>
              </>
            ) : (
              <>
                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Total Dépenses</span>
                <span className="text-3xl font-black text-gray-900">
                  {Math.round(currentMonthTransactions.filter(t => t.type === 'EXPENSE').reduce((a,b)=>a+b.amount,0))}€
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 text-white p-6 rounded-[40px] shadow-xl relative overflow-hidden group">
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
        <div className="flex items-center gap-2 mb-3">
            <h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-indigo-400">Zen Advisor</h4>
        </div>
        <p className={`text-[14px] font-medium leading-snug ${loadingAdvice ? 'opacity-40' : 'opacity-100'}`}>
          "{aiAdvice}"
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
