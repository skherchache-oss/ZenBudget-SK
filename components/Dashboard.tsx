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
}

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, categories, activeAccount, checkingAccountBalance, availableBalance, projectedBalance 
}) => {
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse de flux...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const stats = useMemo(() => {
    let income = 0, expenses = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expenses += t.amount;
    });
    return { income, expenses, net: income - expenses };
  }, [transactions]);

  const fetchAiAdvice = async () => {
    const apiKey = (window as any).process?.env?.API_KEY;
    if (!apiKey) {
      setAiAdvice("Conseil : Maintenez un reste à vivre de 30% après charges fixes.");
      return;
    }

    setLoadingAdvice(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Expert en trésorerie. Analyse : Solde ${availableBalance}€, Revenus ${stats.income}€, Dépenses ${stats.expenses}€. Donne 1 conseil de max 60 car. Ton direct, pro. Pas de blabla.`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      setAiAdvice(text.slice(0, 65));
    } catch (err) {
      setAiAdvice("Conseil : Anticipez vos prélèvements pour éviter les découverts.");
    } finally {
      setLoadingAdvice(false);
    }
  };

  useEffect(() => {
    fetchAiAdvice();
  }, [availableBalance]);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([id, value]) => {
      const cat = categories.find(c => c.id === id);
      return { id, name: cat?.name || 'Autres', value, color: cat?.color || '#94a3b8', icon: cat?.icon || '📦' };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories]);

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1">
      <div className="pt-4 flex flex-col">
        <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">Bilan ✨</h2>
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1.5">{activeAccount.name}</p>
      </div>

      <div className="space-y-1">
        <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">🏦 Solde Bancaire</h2>
        <div className="bg-slate-900 px-6 py-9 rounded-[40px] shadow-2xl relative overflow-hidden">
          <span className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] block mb-1">Actuel</span>
          <div className="text-5xl font-black tracking-tighter text-white">
            {Math.round(checkingAccountBalance).toLocaleString('fr-FR')}€
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-lg">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest">Disponible Réel</span>
          <div className="text-2xl font-black text-white">{Math.round(availableBalance).toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Fin de mois</span>
          <div className={`text-2xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>
            {Math.round(projectedBalance).toLocaleString('fr-FR')}€
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md p-5 rounded-[28px] border border-white shadow-sm flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          {loadingAdvice ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : "💡"}
        </div>
        <div className="flex-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 block">Expert IA</span>
          <p className="text-[11px] font-bold text-slate-700 leading-tight">{aiAdvice}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Répartition</h3>
        <div className="space-y-3">
          {categorySummary.slice(0, 5).map(cat => (
            <div key={cat.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{cat.icon}</span>
                <span className="text-[10px] font-black uppercase text-slate-800 tracking-tight">{cat.name}</span>
              </div>
              <span className="text-[11px] font-black text-slate-900">{Math.round(cat.value)}€</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;