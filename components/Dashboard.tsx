
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
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
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse en cours...");
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
      if (!process.env.API_KEY) {
        setAiAdvice(availableBalance < 100 ? "Prévoyez une marge pour les imprévus." : "Votre disponible est confortable, savourez l'instant.");
        return;
      }
      setLoadingAdvice(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `ZenBudget: Bancaire ${checkingAccountBalance}€, Disponible ${availableBalance}€, Fixes ${stats.fixed}€, Variables ${stats.variable}€. Donne 1 conseil bienveillant et zen très court (50 car max, français). Pas de chiffres.`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setAiAdvice(response.text?.trim() || "La clarté apporte la sérénité.");
        lastAdviceKey.current = currentKey;
      } catch (err) { setAiAdvice("Observez vos flux sans jugement."); }
      finally { setLoadingAdvice(false); }
    };
    const timer = setTimeout(fetchAiAdvice, 1000);
    return () => clearTimeout(timer);
  }, [month, year, availableBalance, checkingAccountBalance, stats.fixed, stats.variable]);

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
      `ZENBUDGET - BILAN FINANCIER${s}${activeAccount.name.toUpperCase()}`,
      `Période${s}${MONTHS_FR[month]} ${year}`,
      `Date de génération${s}${new Date().toLocaleString('fr-FR')}`,
      "",
      "--- RÉSUMÉ GLOBAL ---",
      `Report mois précédent${s}${f(carryOver)} €`,
      `Entrées (Revenus)${s}${f(stats.income)} €`,
      `Sorties (Dépenses)${s}${f(stats.expenses)} €`,
      `Balance Mensuelle${s}${f(stats.net)} €`,
      `Solde Bancaire Actuel${s}${f(checkingAccountBalance)} €`,
      `Disponible Réel (Après fixes)${s}${f(availableBalance)} €`,
      `Projection Fin de Mois${s}${f(projectedBalance)} €`,
      "",
      "--- NATURE DES FRAIS ---",
      `Charges Fixes${s}${f(stats.fixed)} €${s}${stats.expenses > 0 ? Math.round((stats.fixed/stats.expenses)*100) : 0}%`,
      `Charges Variables${s}${f(stats.variable)} €${s}${stats.expenses > 0 ? Math.round((stats.variable/stats.expenses)*100) : 0}%`,
      "",
      "--- RÉPARTITION PAR CATÉGORIES (Dépenses) ---",
      `Catégorie${s}Montant${s}Part (%)`
    ];

    categorySummary.forEach(c => {
      rows.push(`${c.icon} ${c.name}${s}${f(c.value)} €${s}${Math.round(c.percent)}%`);
    });

    rows.push("", "--- JOURNAL DÉTAILLÉ ---", `Date${s}Catégorie${s}Type${s}Détails${s}Montant${s}Fixe${s}Solde Cumulé`);
    
    let running = carryOver;
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedTx.forEach(t => {
      const catName = categories.find(c => c.id === t.categoryId)?.name || 'Inconnue';
      running += (t.type === 'INCOME' ? t.amount : -t.amount);
      rows.push(`${new Date(t.date).toLocaleDateString('fr-FR')}${s}${catName}${s}${t.type === 'INCOME' ? 'REVENU' : 'DÉPENSE'}${s}"${(t.comment || '').replace(/;/g, ',')}"${s}${f(t.amount)} €${s}${t.isRecurring ? 'OUI' : 'NON'}${s}${f(running)} €`);
    });

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `ZenBudget_${activeAccount.name}_Report.csv`; link.click();
  };

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1">
      {/* HEADER */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">Hello ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1 truncate max-w-[140px]">
            {activeAccount.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm text-[9px] font-black uppercase tracking-widest text-slate-500 active:scale-95 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export <span className="xs:inline">CSV</span>
          </button>
          <div className="relative">
            <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-2xl border border-slate-100 shadow-sm active:scale-95">
              <div className="w-3.5 h-3.5 rounded-full ring-2 ring-white" style={{ backgroundColor: activeAccount.color }} />
            </button>
            {showAccountMenu && (
              <div className="absolute top-14 right-0 w-48 bg-white rounded-[24px] shadow-2xl border border-slate-100 py-2 z-[70] animate-in zoom-in-95 duration-200">
                {allAccounts.map(acc => (
                  <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-[10px] font-black uppercase text-slate-600 text-left">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} /> {acc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HERO CARD */}
      <div className="bg-slate-900 px-6 py-10 rounded-[48px] shadow-2xl relative overflow-visible flex flex-col justify-center min-h-[140px] group">
        <div className="relative z-10 flex flex-col gap-1">
          <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Solde Bancaire</span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-4xl xs:text-5xl font-black tracking-tighter text-white leading-tight">
              {Math.round(checkingAccountBalance).toLocaleString('fr-FR')}
            </span>
            <span className="text-xl font-black text-slate-500 mb-1">€</span>
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-500/15 rounded-full blur-[60px] pointer-events-none group-hover:bg-indigo-500/25 transition-all" />
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-xl flex flex-col gap-2 relative overflow-hidden">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest relative z-10">Disponible Réel</span>
          <div className="text-2xl font-black text-white relative z-10">{Math.round(availableBalance).toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-2">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Fin de mois</span>
          <div className={`text-2xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{Math.round(projectedBalance).toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      {/* IN / OUT FLOWS */}
      <section className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <span>🔄</span> Bilan des flux
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tight">Entrées</span>
            <div className="text-lg font-black text-slate-800">+{Math.round(stats.income).toLocaleString('fr-FR')}€</div>
            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
               <div className="h-full bg-emerald-500 rounded-full" style={{ width: stats.income > 0 ? '100%' : '0%' }} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] font-black text-red-400 uppercase tracking-tight">Sorties</span>
            <div className="text-lg font-black text-slate-800">-{Math.round(stats.expenses).toLocaleString('fr-FR')}€</div>
            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
               <div className="h-full bg-red-400 rounded-full" style={{ width: stats.expenses > 0 ? '100%' : '0%' }} />
            </div>
          </div>
        </div>
      </section>

      {/* FIXED / VARIABLE ANALYSIS */}
      <section className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <span>⚡️</span> Nature des frais
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-sm">⚓️</div>
               <div>
                 <p className="text-[10px] font-black text-slate-800 uppercase leading-none">Charges Fixes</p>
                 <p className="text-[9px] text-slate-400 font-bold mt-0.5">Loyer, abonnements...</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-sm font-black text-slate-800">{Math.round(stats.fixed).toLocaleString('fr-FR')}€</p>
               <p className="text-[9px] font-black text-indigo-500 uppercase">{stats.expenses > 0 ? Math.round((stats.fixed/stats.expenses)*100) : 0}%</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-sm">🪁</div>
               <div>
                 <p className="text-[10px] font-black text-slate-800 uppercase leading-none">Charges Variables</p>
                 <p className="text-[9px] text-slate-400 font-bold mt-0.5">Vie courante, imprévus...</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-sm font-black text-slate-800">{Math.round(stats.variable).toLocaleString('fr-FR')}€</p>
               <p className="text-[9px] font-black text-amber-500 uppercase">{stats.expenses > 0 ? Math.round((stats.variable/stats.expenses)*100) : 0}%</p>
            </div>
          </div>
          
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
             <div className="h-full bg-indigo-500" style={{ width: stats.expenses > 0 ? `${(stats.fixed/stats.expenses)*100}%` : '0%' }} />
             <div className="h-full bg-amber-400" style={{ width: stats.expenses > 0 ? `${(stats.variable/stats.expenses)*100}%` : '0%' }} />
          </div>
        </div>
      </section>

      {/* AI ADVICE */}
      <div className="bg-slate-100 p-5 rounded-[28px] flex items-center gap-4 border border-white">
        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl shrink-0">🧘</div>
        <p className={`text-[11px] font-medium leading-tight text-slate-600 italic transition-opacity ${loadingAdvice ? 'opacity-30' : 'opacity-100'}`}>
          "{aiAdvice}"
        </p>
      </div>

      {/* CATEGORY BREAKDOWN */}
      <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
           <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Répartition Catégories</h3>
           <span className="text-[9px] font-black text-slate-300 uppercase">Dépenses</span>
        </div>

        <div className="w-full h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={categorySummary} 
                cx="50%" 
                cy="50%" 
                innerRadius={60} 
                outerRadius={80} 
                paddingAngle={4} 
                dataKey="value" 
                stroke="none" 
                {...({
                  activeIndex: activeIndex === null ? -1 : activeIndex,
                  activeShape: renderActiveShape,
                  onMouseEnter: (_: any, idx: number) => setActiveIndex(idx),
                  onMouseLeave: () => setActiveIndex(null)
                } as any)}
              >
                {categorySummary.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hoveredCategory ? (
              <div className="text-center">
                <span className="text-3xl">{hoveredCategory.icon}</span>
                <div className="text-[11px] font-black text-slate-900 uppercase">{Math.round(hoveredCategory.percent)}%</div>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[9px] font-black text-slate-300 uppercase">Sorties</span>
                <span className="text-lg font-black text-slate-900">{Math.round(stats.expenses).toLocaleString('fr-FR')}€</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {categorySummary.map((item, idx) => (
            <div 
              key={item.id} 
              className={`flex items-center justify-between p-3 rounded-2xl transition-all ${activeIndex === idx ? 'bg-slate-50 scale-102' : ''}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
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
