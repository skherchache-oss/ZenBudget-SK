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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse financière Zen...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const stats = useMemo(() => {
    let income = 0, expenses = 0, fixed = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else {
        expenses += t.amount;
        if (t.isRecurring) fixed += t.amount;
      }
    });
    return { income, expenses, fixed, variable: expenses - fixed, net: income - expenses };
  }, [transactions]);

  const fetchAiAdvice = async () => {
    // Vite utilise import.meta.env pour les variables préfixées par VITE_
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      setAiAdvice("ZenTip : Optimisez vos charges fixes pour augmenter votre épargne.");
      return;
    }

    setLoadingAdvice(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // On teste 'gemini-1.5-flash', si ça échoue, le catch prendra le relais
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Tu es un expert ZenBudget.
        Contexte : Solde ${availableBalance}€, Dépenses ${stats.expenses}€.
        Donne 1 conseil financier très court (max 60 car). Pas de guillemets.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      
      if (text) setAiAdvice(text);
    } catch (err) { 
      console.error("Erreur Gemini détaillée:", err);
      // Fallback au cas où le modèle ou l'API v1beta pose problème
      setAiAdvice("ZenTip : Surveillez vos dépenses variables pour rester serein."); 
    } finally { 
      setLoadingAdvice(false); 
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchAiAdvice, 1500);
    return () => clearTimeout(timer);
  }, [availableBalance]);

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

  const handleExportCSV = () => {
    try {
      const s = ";"; 
      const f = (n: number) => n.toFixed(2).replace('.', ',');
      const rows = [
        `ZENBUDGET - ${activeAccount.name.toUpperCase()}`,
        `Solde Bancaire${s}${f(checkingAccountBalance)} €`,
        `Disponible${s}${f(availableBalance)} €`,
        "",
        "Catégorie;Montant;Part"
      ];
      categorySummary.forEach(c => rows.push(`${c.name}${s}${f(c.value)}${s}${Math.round(c.percent)}%`));
      const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `ZenBudget_Stats.csv`; link.click();
    } catch (e) { console.error(e); }
  };

  const formatVal = (v: number) => Math.round(v).toLocaleString('fr-FR');

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      <div className="flex items-center justify-between pt-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Stats Zen ✨</h2>
          <p className="text-[10px] font-black uppercase text-indigo-500 mt-1.5">{activeAccount.name}</p>
        </div>
        <button onClick={handleExportCSV} className="px-4 py-2.5 bg-slate-900 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Exporter CSV</button>
      </div>

      <div className="bg-slate-900 px-6 py-9 rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[130px]">
        <span className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Solde Bancaire Pointé</span>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black text-white tracking-tighter">{formatVal(checkingAccountBalance)}</span>
          <span className="text-xl font-black text-slate-500">€</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-lg flex flex-col gap-1 border border-indigo-500/20">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest leading-none mb-1">Disponible Réel</span>
          <div className="text-2xl font-black text-white">{formatVal(availableBalance)}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest leading-none mb-1">Fin de mois</span>
          <div className={`text-2xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{formatVal(projectedBalance)}€</div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md p-5 rounded-[28px] flex items-center gap-4 border border-white shadow-sm cursor-pointer active:scale-[0.98] transition-all" onClick={() => !loadingAdvice && fetchAiAdvice()}>
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          {loadingAdvice ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : "💡"}
        </div>
        <p className="text-[11px] font-bold text-slate-700 leading-tight">{aiAdvice}</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-[40px] p-6 border border-white shadow-xl">
        <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-1">Répartition des charges</h2>
        <div className="h-[240px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categorySummary} innerRadius={75} outerRadius={100} paddingAngle={8} dataKey="value" onMouseEnter={(_, i) => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)} stroke="none">
                {categorySummary.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.color} opacity={activeIndex === null || activeIndex === i ? 1 : 0.3} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {activeIndex !== null ? (
              <>
                <span className="text-2xl mb-1">{categorySummary[activeIndex].icon}</span>
                <span className="text-lg font-black text-slate-900">{formatVal(categorySummary[activeIndex].value)}€</span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-black uppercase text-slate-400">Total</span>
                <span className="text-2xl font-black text-slate-900">{formatVal(stats.expenses)}€</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;