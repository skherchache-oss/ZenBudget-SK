import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

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

  const isAttention = projectedBalance < 0;
  const isVigilance = availableBalance < 50;
  const isCapacity = stats.income > 0 && projectedBalance > (stats.income * 0.2);

  const fetchAiAdvice = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setAiAdvice("ZenTip : La régularité est la clé de la sérénité. 🌿");
      return;
    }
    setLoadingAdvice(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Donne un conseil financier zen très court (60 car max) en français sans guillemets." }] }]
          })
        }
      );
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) setAiAdvice(text.trim());
    } catch (err) { 
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
    try {
      const s = ";"; 
      const f = (n: number) => n.toFixed(2).replace('.', ',');
      const rows = [
        `ZENBUDGET - EXPORT - ${activeAccount.name.toUpperCase()}`,
        `Période : ${month + 1}/${year}`,
        "",
        `Solde Bancaire${s}${f(checkingAccountBalance)} €`,
        `Disponible Réel${s}${f(availableBalance)} €`,
        "",
        "Date;Categorie;Note;Type;Montant"
      ];
      transactions.forEach(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        rows.push(`${new Date(t.date).toLocaleDateString('fr-FR')}${s}${cat?.name || 'Autre'}${s}${t.comment || ''}${s}${t.type}${s}${f(t.amount)}`);
      });
      const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `ZenBudget_${activeAccount.name}.csv`;
      link.click();
    } catch (e) { console.error(e); }
  };

  const formatVal = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 2 }).format(v);

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      {isAttention && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-3xl flex items-center gap-3 animate-pulse">
          <span className="text-xl">🧘‍♀️</span>
          <p className="text-[11px] font-black text-red-600 leading-tight">Attention Zen : Votre projection est négative.</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Bilan Zen ✨</h2>
          <button onClick={() => allAccounts.length > 1 && onSwitchAccount(allAccounts[(allAccounts.findIndex(a => a.id === activeAccount.id) + 1) % allAccounts.length].id)} className="flex items-center gap-1.5 mt-1 text-left active:opacity-60 transition-opacity">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{activeAccount.name}</p>
            {allAccounts.length > 1 && <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>}
          </button>
        </div>
        
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 rounded-2xl shadow-xl active:scale-95 text-white border border-slate-800 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
        <div className={`p-5 rounded-[32px] shadow-lg relative transition-colors duration-500 ${availableBalance < 0 ? 'bg-red-500' : 'bg-indigo-600'}`}>
          <span className={`${availableBalance < 0 ? 'text-red-100' : 'text-indigo-200'} text-[8px] font-black uppercase tracking-widest block mb-1`}>Disponible Réel</span>
          <div className="text-xl font-black text-white">{formatVal(availableBalance)}€</div>
          {(isVigilance || availableBalance < 0) && <div className="absolute top-3 right-3 w-2 h-2 bg-white rounded-full animate-pulse" />}
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm relative">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-1">Projection Fin</span>
          <div className={`text-xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{formatVal(projectedBalance)}€</div>
          {isCapacity && <span className="absolute top-3 right-3 text-xs animate-bounce">🚀</span>}
        </div>
      </div>

      {/* ... Suite du Dashboard identique ... */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-[28px] border border-slate-50 shadow-sm">
          <span className="text-emerald-500 text-[8px] font-black uppercase tracking-widest mb-1 block">Entrées</span>
          <div className="text-[15px] font-black text-slate-800">+{formatVal(stats.income)}€</div>
        </div>
        <div className="bg-white p-4 rounded-[28px] border border-slate-50 shadow-sm">
          <span className="text-red-400 text-[8px] font-black uppercase tracking-widest mb-1 block">Sorties</span>
          <div className="text-[15px] font-black text-slate-800">-{formatVal(stats.expenses)}€</div>
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
        <div className="h-[240px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categorySummary} innerRadius={75} outerRadius={100} paddingAngle={8} dataKey="value" onMouseEnter={(_, index) => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} stroke="none">
                {categorySummary.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} opacity={activeIndex === null || activeIndex === index ? 1 : 0.3} />)}
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0" style={{ backgroundColor: `${cat.color}15` }}>{cat.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{cat.name}</span>
                  <span className="text-[12px] font-black text-slate-900">{formatVal(cat.value)}€</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                </div>
              </div>
              <div className="text-[9px] font-black text-slate-400 w-8 text-right">{Math.round(cat.percent)}%</div>
            </div>
          )) : <div className="text-center py-6 text-[10px] font-black text-slate-300 uppercase italic">Aucune dépense</div>}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;