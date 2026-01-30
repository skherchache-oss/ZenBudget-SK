import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
// CORRECTION : Utilisation du package officiel compatible ESM/Vercel
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

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 4} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, categories, activeAccount, allAccounts, onSwitchAccount, month, year, checkingAccountBalance, availableBalance, projectedBalance, carryOver 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse zen en cours...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const lastAdviceKey = useRef<string>("");

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

  useEffect(() => {
    const fetchAiAdvice = async () => {
      const currentKey = `${month}-${year}-${Math.round(availableBalance / 10)}`;
      if (lastAdviceKey.current === currentKey) return;
      
      // Utilisation de window.process pour éviter les crashs au build
      const apiKey = (window as any).process?.env?.API_KEY;

      if (!apiKey) {
        setAiAdvice(availableBalance < 100 ? "Prévoyez une marge pour les imprévus." : "Votre disponible est confortable.");
        return;
      }

      setLoadingAdvice(true);
      try {
        // CORRECTION : Nouvelle syntaxe GoogleGenerativeAI
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `ZenBudget: Disponible ${availableBalance}€, Fixes ${stats.fixed}€, Variables ${stats.variable}€. Donne 1 conseil bienveillant et zen très court (50 car max, français). Pas de chiffres.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        setAiAdvice(text.trim() || "La clarté apporte la sérénité.");
        lastAdviceKey.current = currentKey;
      } catch (err) { 
        console.error("AI Error:", err);
        setAiAdvice("Observez vos flux sans jugement."); 
      } finally { 
        setLoadingAdvice(false); 
      }
    };
    const timer = setTimeout(fetchAiAdvice, 1000);
    return () => clearTimeout(timer);
  }, [month, year, availableBalance, stats.fixed, stats.variable]);

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
    const s = ";"; 
    const f = (n: number) => n.toFixed(2).replace('.', ',');
    const rows: string[] = [
      `ZENBUDGET - EXPORT${s}${activeAccount.name.toUpperCase()}`,
      `Période${s}${MONTHS_FR[month]} ${year}`,
      "",
      `Solde Bancaire${s}${f(checkingAccountBalance)} €`,
      `Disponible Réel${s}${f(availableBalance)} €`,
      `Projection Fin de Mois${s}${f(projectedBalance)} €`,
      "",
      "--- CATEGORIES ---",
      `Nom${s}Montant${s}Part`
    ];

    categorySummary.forEach(c => {
      rows.push(`${c.name}${s}${f(c.value)} €${s}${Math.round(c.percent)}%`);
    });

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `ZenBudget_${activeAccount.name.replace(/\s+/g, '_')}.csv`; link.click();
  };

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      <div className="flex items-center justify-between pt-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">Hello ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1">{activeAccount.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm text-[9px] font-black uppercase tracking-widest text-slate-500 active:scale-95 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
          <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="bg-white px-3 py-2.5 rounded-2xl border border-slate-100 shadow-sm active:scale-95">
             <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: activeAccount.color }} />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 px-6 py-10 rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[140px]">
        <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-1">Solde Bancaire Actuel</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl xs:text-5xl font-black tracking-tighter text-white">{Math.round(checkingAccountBalance).toLocaleString('fr-FR')}</span>
          <span className="text-xl font-black text-slate-500">€</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-xl flex flex-col gap-1">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest">Disponible Réel</span>
          <div className="text-2xl font-black text-white">{Math.round(availableBalance).toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Fin de mois</span>
          <div className={`text-2xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{Math.round(projectedBalance).toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      <section className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><span>🔄</span> Bilan des flux</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-emerald-500 uppercase">Entrées</span>
            <div className="text-lg font-black text-slate-800">+{Math.round(stats.income).toLocaleString('fr-FR')}€</div>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] font-black text-red-400 uppercase">Sorties</span>
            <div className="text-lg font-black text-slate-800">-{Math.round(stats.expenses).toLocaleString('fr-FR')}€</div>
          </div>
        </div>
      </section>

      <div className="bg-slate-100 p-5 rounded-[28px] flex items-center gap-4 border border-white">
        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl shrink-0">🧘</div>
        <p className={`text-[11px] font-medium leading-tight text-slate-600 italic ${loadingAdvice ? 'opacity-30' : 'opacity-100'}`}>
          "{aiAdvice}"
        </p>
      </div>

      <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest text-center">Répartition Catégories</h3>
        <div className="w-full h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={categorySummary} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none" 
                onMouseEnter={(_: any, idx: number) => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {categorySummary.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {hoveredCategory ? (
              <>
                <span className="text-2xl">{hoveredCategory.icon}</span>
                <span className="text-[10px] font-black uppercase text-slate-900">{Math.round(hoveredCategory.percent)}%</span>
              </>
            ) : (
              <>
                <span className="text-[9px] font-black text-slate-300 uppercase">Total Sorties</span>
                <span className="text-lg font-black text-slate-900">{Math.round(stats.expenses).toLocaleString('fr-FR')}€</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {categorySummary.map((item, idx) => (
            <div 
              key={item.id} 
              className={`flex items-center justify-between p-3 rounded-2xl transition-all ${activeIndex === idx ? 'bg-slate-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-lg">{item.icon}</div>
                <div>
                  <div className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{item.name}</div>
                  <div className="text-[9px] text-slate-400 font-bold">{Math.round(item.percent)}%</div>
                </div>
              </div>
              <div className="text-[12px] font-black text-slate-900">{Math.round(item.value).toLocaleString('fr-FR')}€</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;