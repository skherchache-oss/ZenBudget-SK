import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
// CORRECTION : Utilisation du package officiel stable
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
  transactions, categories, activeAccount, allAccounts, onSwitchAccount, checkingAccountBalance, availableBalance, projectedBalance, month, year 
}) => {
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
    if (loadingAdvice) return;
    setLoadingAdvice(true);
    try {
      // CORRECTION : Utilisation de import.meta.env pour Vite/Vercel
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey) throw new Error("Clé manquante");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = "Donne un conseil financier zen très court (max 60 caractères) en français, sans guillemets, inspirant et pratique.";
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      setAiAdvice(text || "La simplicité apporte la paix d'esprit. 🌿");
    } catch (err) {
      console.error("Erreur AI:", err);
      setAiAdvice("ZenTip : Respirez, votre budget est sous contrôle. ✨");
    } finally {
      setLoadingAdvice(false);
    }
  };

  useEffect(() => {
    fetchAiAdvice();
  }, [activeAccount.id]);

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
    if (!activeAccount) return;

    const now = new Date();
    const rows = [];
    
    rows.push(["RESUME DU COMPTE"]);
    rows.push(["Nom du compte", activeAccount.name]);
    rows.push(["Date d'export", now.toLocaleDateString()]);
    rows.push(["Solde Actuel", `${checkingAccountBalance.toFixed(2)} €`]);
    rows.push(["Disponible estime (Fin de mois)", `${projectedBalance.toFixed(2)} €`]);
    rows.push([]); 
    
    rows.push(["DETAILS DES OPERATIONS"]);
    rows.push(["Date", "Type", "Categorie", "Montant", "Note"]);
    
    [...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      rows.push([
        t.date.split('T')[0], 
        t.type === 'INCOME' ? 'Revenu' : 'Depense', 
        cat?.name || 'Inconnue', 
        t.amount.toString().replace('.', ','), 
        (t.comment || '').replace(/;/g, ',')
      ]);
    });

    const csvContent = rows.map(e => e.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `zenbudget_${activeAccount.name.toLowerCase()}.csv`);
    link.click();
  };

  const formatVal = (v: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(v);

  const getAvailableColor = () => {
    if (availableBalance < 0) return 'bg-rose-500';
    if (availableBalance <= 100) return 'bg-amber-500';
    return 'bg-indigo-600';
  };

  const isAttention = projectedBalance < 0;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      {isAttention && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-3xl flex items-center gap-3 animate-pulse">
          <span className="text-xl">🧘‍♀️</span>
          <p className="text-[11px] font-black text-rose-600 leading-tight">Attention Zen : Votre projection est négative.</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Bilan Zen ✨</h2>
          <button onClick={() => allAccounts.length > 1 && onSwitchAccount(allAccounts[(allAccounts.findIndex(a => a.id === activeAccount.id) + 1) % allAccounts.length].id)} className="flex items-center gap-1.5 mt-1 text-left active:opacity-60 transition-opacity">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{activeAccount.name}</p>
          </button>
        </div>
        
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 rounded-2xl shadow-xl active:scale-95 text-white border border-slate-800 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Export CSV</span>
        </button>
      </div>

      <div className="bg-slate-900 px-6 py-9 rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[130px]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <span className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Solde Bancaire Actuel</span>
        <div className="flex items-baseline gap-2 overflow-hidden">
          <span className={`text-4xl font-black tracking-tighter truncate ${checkingAccountBalance < 0 ? 'text-rose-400' : 'text-white'}`}>
            {formatVal(checkingAccountBalance)}
          </span>
          <span className="text-xl font-black text-slate-500">€</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`p-5 rounded-[32px] shadow-lg relative transition-all duration-700 ${getAvailableColor()}`}>
          <span className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${availableBalance < 0 ? 'text-rose-100' : 'text-indigo-200'}`}>Disponible Réel</span>
          <div className="text-xl font-black text-white">{formatVal(availableBalance)}€</div>
          {availableBalance <= 100 && <div className="absolute top-3 right-3 w-2 h-2 bg-white rounded-full animate-pulse" />}
        </div>
        
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm relative">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-1">Projection Fin</span>
          <div className={`text-xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-rose-500'}`}>{formatVal(projectedBalance)}€</div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md p-5 rounded-[28px] flex items-center gap-4 border border-white shadow-sm active:scale-[0.98] transition-all cursor-pointer" onClick={() => !loadingAdvice && fetchAiAdvice()}>
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
          {loadingAdvice ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : "💡"}
        </div>
        <p className="text-[11px] font-bold text-slate-700 leading-tight">{aiAdvice}</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-[40px] p-6 border border-white shadow-xl">
        <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Répartition des dépenses</h2>
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