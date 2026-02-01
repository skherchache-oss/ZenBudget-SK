import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
// Correction pour Vercel : Utilisation du package officiel
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
  transactions, categories, activeAccount, checkingAccountBalance, availableBalance, projectedBalance, month, year 
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
    // Correction de l'accès aux variables d'environnement pour Vite/Vercel
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    
    if (!apiKey) {
      setAiAdvice("ZenTip : Optimisez vos charges fixes pour augmenter votre capacité d'épargne.");
      return;
    }

    setLoadingAdvice(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const randomSeed = Math.random().toString(36).substring(7);
      
      const prompt = `Tu es un coach financier pour l'app ZenBudget. 
        Contexte : Solde dispo (fixes inclus) = ${availableBalance}€, Dépenses du mois = ${stats.expenses}€.
        Donne un conseil court (max 60 car.) sur la gestion de budget ou l'épargne. 
        Style : Zen, motivant, français. Graine: ${randomSeed}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim().replace(/^["']|["']$/g, '');
      
      if (text && text.length > 5) setAiAdvice(text);
    } catch (err) { 
      setAiAdvice("ZenTip : Gardez un œil sur vos d'épenses variables ce mois-ci."); 
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
      const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR');
      };

      const rows: string[] = [
        `ZENBUDGET - EXPORT COMPLET - ${activeAccount.name.toUpperCase()}`,
        `Période : ${month + 1}/${year}`,
        "",
        `Solde Bancaire Actuel${s}${f(checkingAccountBalance)} €`,
        `Disponible (fixes inclus)${s}${f(availableBalance)} €`,
        `Projection Fin de Mois${s}${f(projectedBalance)} €`,
        "",
        "--- RÉSUMÉ PAR CATÉGORIE ---",
        `Catégorie${s}Montant${s}Part (%)`
      ];

      categorySummary.forEach(c => {
        rows.push(`${c.name}${s}${f(c.value)}${s}${Math.round(c.percent)}%`);
      });

      rows.push("", "--- DÉTAIL DES OPÉRATIONS ---");
      rows.push(`Date${s}Catégorie${s}Note/Libellé${s}Type${s}Montant`);

      const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      sortedTxs.forEach(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        const typeLabel = t.type === 'INCOME' ? 'Revenu' : 'Dépense';
        const prefix = t.type === 'INCOME' ? '' : '-';
        rows.push(`${formatDate(t.date)}${s}${cat?.name || 'Autre'}${s}${t.comment || ''}${s}${typeLabel}${s}${prefix}${f(t.amount)}`);
      });

      const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; 
      link.download = `ZenBudget_Export_${month + 1}_${year}.csv`; 
      link.click();
    } catch (e) { 
      console.error("Export error:", e); 
    }
  };

  const formatVal = (v: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  };

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      <div className="flex items-center justify-between pt-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Stats Zen ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1.5">{activeAccount.name}</p>
        </div>
        
        {/* Bouton Export avec Icône Téléchargement Standard */}
        <button 
          onClick={handleExportCSV} 
          className="px-4 py-2.5 bg-slate-900 rounded-2xl shadow-xl active:scale-95 text-white border border-slate-800 flex items-center gap-2 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Export CSV</span>
        </button>
      </div>

      <div className="bg-slate-900 px-6 py-9 rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[130px]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <span className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Solde Bancaire Aujourd'hui</span>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black tracking-tighter text-white">{formatVal(checkingAccountBalance)}</span>
          <span className="text-xl font-black text-slate-500">€</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-lg flex flex-col gap-1 border border-indigo-500/20">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest mb-1 leading-none">Disponible Réel (incl. fixes)</span>
          <div className="text-xl font-black text-white">{formatVal(availableBalance)}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-1 leading-none">Projection Fin</span>
          <div className={`text-xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{formatVal(projectedBalance)}€</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-[28px] border border-slate-50 shadow-sm flex flex-col justify-center">
          <span className="text-emerald-500 text-[8px] font-black uppercase tracking-widest mb-1 block">Entrées (Mois)</span>
          <div className="text-[15px] font-black text-slate-800">+{formatVal(stats.income)}€</div>
        </div>
        <div className="bg-white p-4 rounded-[28px] border border-slate-50 shadow-sm flex flex-col justify-center">
          <span className="text-red-400 text-[8px] font-black uppercase tracking-widest mb-1 block">Sorties (Mois)</span>
          <div className="text-[15px] font-black text-slate-800">-{formatVal(stats.expenses)}€</div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md p-5 rounded-[28px] flex items-center gap-4 border border-white shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer" onClick={() => !loadingAdvice && fetchAiAdvice()}>
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
          {loadingAdvice ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : "💡"}
        </div>
        <p className="text-[11px] font-bold text-slate-700 leading-tight">{aiAdvice}</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-[40px] p-6 border border-white shadow-xl">
        <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Répartition des dépenses</h2>
        
        <div className="h-[240px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categorySummary} innerRadius={75} outerRadius={100} paddingAngle={8} dataKey="value" onMouseEnter={(_, index) => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} stroke="none">
                {categorySummary.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} opacity={activeIndex === null || activeIndex === index ? 1 : 0.3} />
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

        <div className="mt-8 space-y-3">
          {categorySummary.length > 0 ? categorySummary.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100/50 group hover:bg-white hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0" style={{ backgroundColor: `${cat.color}15` }}>
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{cat.name}</span>
                  <span className="text-[12px] font-black text-slate-900">{formatVal(cat.value)}€</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                </div>
              </div>
              <div className="text-[9px] font-black text-slate-400 w-8 text-right">
                {Math.round(cat.percent)}%
              </div>
            </div>
          )) : (
            <div className="text-center py-6">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Aucune dépense enregistrée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;