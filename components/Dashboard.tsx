import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, categories, activeAccount, 
  checkingAccountBalance, availableBalance, projectedBalance, carryOver,
  onAddTransaction, month, year 
}) => {
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse financière Zen...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const fetchAiAdvice = async () => {
    // Récupération de la clé avec le nom correct
    const API_KEY = 
      (import.meta as any).env?.VITE_GEMINI_API_KEY || 
      (window as any).process?.env?.VITE_GEMINI_API_KEY ||
      "";

    if (!API_KEY) {
      console.warn("Clé VITE_GEMINI_API_KEY introuvable.");
      setAiAdvice("Clé API non détectée. Vérifiez Vercel. ✨");
      return;
    }

    if (loadingAdvice) return;
    
    setLoadingAdvice(true);
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const result = await model.generateContent("Donne un conseil financier zen très court (max 60 caractères) en français, sans guillemets.");
      const response = await result.response;
      setAiAdvice(response.text());
    } catch (err) {
      console.error("Erreur IA:", err);
      setAiAdvice("ZenTip : Respirez, votre budget est sous contrôle. ✨");
    } finally {
      setLoadingAdvice(false);
    }
  };

  useEffect(() => {
    fetchAiAdvice();
  }, [activeAccount.id]);

  const stats = useMemo(() => {
    let income = 0, expenses = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expenses += t.amount;
    });
    return { income, expenses };
  }, [transactions]);

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

  const handleApplyCarryOver = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddTransaction({
      amount: Math.abs(carryOver),
      type: carryOver >= 0 ? 'INCOME' : 'EXPENSE',
      categoryId: 'carry-over',
      comment: `Report du mois précédent`,
      date: new Date(year, month, 1, 12).toISOString(),
    });
  };

  const formatVal = (v: number) => new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(v);

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      <div className="pt-6">
        <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Bilan Zen ✨</h2>
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{activeAccount.name}</p>
      </div>

      {/* Widget Solde Bancaire */}
      <div className="bg-slate-900 px-6 py-9 rounded-[40px] shadow-2xl relative overflow-hidden min-h-[130px] flex flex-col justify-center">
        <span className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Solde Bancaire Actuel</span>
        <div className="text-4xl font-black tracking-tighter text-white">{formatVal(checkingAccountBalance)} €</div>
      </div>

      {/* Disponible et Report */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-5 rounded-[32px] shadow-lg ${availableBalance < 0 ? 'bg-rose-500' : 'bg-indigo-600'}`}>
          <span className="text-[8px] font-black uppercase tracking-widest block mb-1 text-white/70">Disponible Réel</span>
          <div className="text-xl font-black text-white">{formatVal(availableBalance)}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-1">Report Précédent</span>
          <div className={`text-xl font-black flex items-center justify-between ${carryOver >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {formatVal(carryOver)}€
            {carryOver !== 0 && (
              <button onClick={handleApplyCarryOver} className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600 active:scale-95 transition-all">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path d="M12 4v16m8-8H4" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Projection Fin de Mois */}
      <div className={`p-5 rounded-[32px] border-2 flex justify-between items-center ${projectedBalance < 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-50'}`}>
        <div>
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-1">Projection Fin de Mois</span>
          <div className={`text-2xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{formatVal(projectedBalance)}€</div>
        </div>
        {projectedBalance < 0 && <span className="text-2xl animate-bounce">🧘‍♀️</span>}
      </div>

      {/* Widget IA */}
      <div 
        className="bg-white/80 backdrop-blur-md p-5 rounded-[28px] flex items-center gap-4 border border-white shadow-sm active:scale-[0.98] transition-all cursor-pointer" 
        onClick={() => !loadingAdvice && fetchAiAdvice()}
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
          {loadingAdvice ? (
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          ) : "💡"}
        </div>
        <p className="text-[11px] font-bold text-slate-700 leading-tight">{aiAdvice}</p>
      </div>

      {/* Graphique et Répartition */}
      <div className="bg-white/80 backdrop-blur-xl rounded-[40px] p-6 border border-white shadow-xl">
        <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Répartition des dépenses</h2>
        <div className="h-[200px] w-full relative mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categorySummary} innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                {categorySummary.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] font-black uppercase text-slate-400">Total</span>
            <span className="text-xl font-black text-slate-900">{formatVal(stats.expenses)}€</span>
          </div>
        </div>
        <div className="space-y-2">
          {categorySummary.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100/30">
              <span className="text-xl w-8 text-center">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-[11px] font-black uppercase text-slate-800">
                  <span className="truncate">{cat.name}</span>
                  <span>{formatVal(cat.value)}€</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;