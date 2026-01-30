import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
// CORRECTION DE L'IMPORT ICI
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
      // Récupération de la clé depuis les variables d'environnement Vite
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const currentKey = `${month}-${year}-${Math.round(availableBalance / 10)}`;
      
      if (lastAdviceKey.current === currentKey) return;
      
      if (!apiKey || apiKey === "PLACEHOLDER_API_KEY") {
        setAiAdvice(availableBalance < 100 ? "Prévoyez une marge pour les imprévus." : "Votre disponible est confortable, savourez l'instant.");
        return;
      }

      setLoadingAdvice(true);
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `ZenBudget: Bancaire ${checkingAccountBalance}€, Disponible ${availableBalance}€, Fixes ${stats.fixed}€. Conseil bienveillant très court (50 car max). Pas de chiffres.`;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        setAiAdvice(text || "La clarté apporte la sérénité.");
        lastAdviceKey.current = currentKey;
      } catch (err) { 
        console.error("Gemini Error:", err);
        setAiAdvice("Observez vos flux sans jugement."); 
      } finally { 
        setLoadingAdvice(false); 
      }
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
      `ZENBUDGET - BILAN COMPLET${s}${activeAccount.name.toUpperCase()}`,
      `Période${s}${MONTHS_FR[month]} ${year}`,
      `Généré le${s}${new Date().toLocaleString('fr-FR')}`,
      "",
      "--- SYNTHÈSE DES FLUX ---",
      `Report mois précédent${s}${f(carryOver)} €`,
      `Total Entrées (Revenus)${s}${f(stats.income)} €`,
      `Total Sorties (Dépenses)${s}${f(stats.expenses)} €`,
      `Balance Mensuelle${s}${f(stats.net)} €`,
      `Solde Bancaire Actuel${s}${f(checkingAccountBalance)} €`,
      `Disponible Réel (Après fixes)${s}${f(availableBalance)} €`,
      `Projection Fin de Mois${s}${f(projectedBalance)} €`,
      "",
      "--- ANALYSE DE LA NATURE DES FRAIS ---",
      `Charges Fixes${s}${f(stats.fixed)} €${s}${stats.expenses > 0 ? Math.round((stats.fixed/stats.expenses)*100) : 0}%`,
      `Charges Variables${s}${f(stats.variable)} €${s}${stats.expenses > 0 ? Math.round((stats.variable/stats.expenses)*100) : 0}%`,
      "",
      "--- RÉPARTITION PAR CATÉGORIES (Dépenses) ---",
      `Catégorie${s}Montant${s}Part (%)`
    ];

    categorySummary.forEach(c => {
      rows.push(`${c.icon} ${c.name}${s}${f(c.value)} €${s}${Math.round(c.percent)}%`);
    });

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `ZenBudget_${activeAccount.name}_Bilan.csv`; link.click();
  };

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Hello ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1">{activeAccount.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="px-3 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm text-[9px] font-black uppercase tracking-widest text-slate-500 active:scale-95 transition-all">Export</button>
          <div className="relative">
            <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="bg-white px-3 py-2.5 rounded-2xl border border-slate-100 shadow-sm active:scale-95">
              <div className="w-3.5 h-3.5 rounded-full ring-2 ring-white" style={{ backgroundColor: activeAccount.color }} />
            </button>
            {showAccountMenu && (
              <div className="absolute top-14 right-0 w-48 bg-white rounded-[24px] shadow-2xl border border-slate-100 py-2 z-[70]">
                {allAccounts.map(acc => (
                  <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-[10px] font-black uppercase text-slate-600">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} /> {acc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HERO CARD CORRIGÉE (Plus de texte rogné) */}
      <div className="bg-slate-900 px-6 py-10 rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[160px]">
        <div className="relative z-10">
          <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] opacity-80 block mb-2">Solde Bancaire</span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-4xl xs:text-6xl font-black tracking-tighter text-white leading-none break-all">
              {Math.round(checkingAccountBalance).toLocaleString('fr-FR')}
            </span>
            <span className="text-2xl font-black text-slate-500">€</span>
          </div>
        </div>
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-[50px] pointer-events-none" />
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-xl flex flex-col gap-1 min-h-[100px] justify-center">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest">Disponible Réel</span>
          <div className="text-2xl font-black text-white leading-tight break-words">
            {Math.round(availableBalance).toLocaleString('fr-FR')}€
          </div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-1 min-h-[100px] justify-center">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Fin de mois</span>
          <div className={`text-2xl font-black leading-tight break-words ${projectedBalance >= 0 ? 'text-slate-900' : 'text-rose-500'}`}>
            {Math.round(projectedBalance).toLocaleString('fr-FR')}€
          </div>
        </div>
      </div>

      {/* BILAN DU MOIS */}
      <section className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">🔄 Bilan du mois</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-emerald-500 uppercase">Entrées</span>
            <div className="text-lg font-black text-slate-800">+{Math.round(stats.income).toLocaleString('fr-FR')}€</div>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] font-black text-rose-400 uppercase">Sorties</span>
            <div className="text-lg font-black text-slate-800">-{Math.round(stats.expenses).toLocaleString('fr-FR')}€</div>
          </div>
        </div>
      </section>

      {/* AI ADVICE */}
      <div className="bg-slate-100 p-5 rounded-[28px] flex items-center gap-4 border border-white">
        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl shrink-0">🧘</div>
        <p className={`text-[11px] font-medium leading-tight text-slate-600 italic ${loadingAdvice ? 'opacity-30' : ''}`}>
          "{aiAdvice}"
        </p>
      </div>

      {/* CHART */}
      <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm">
        <div className="w-full h-[220px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={categorySummary} cx="50%" cy="50%" innerRadius={65} outerRadius={85} 
                paddingAngle={4} dataKey="value" stroke="none"
                onMouseEnter={(_: any, idx: number) => setActiveIndex(idx)} onMouseLeave={() => setActiveIndex(null)}
              >
                {categorySummary.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {hoveredCategory ? (
              <>
                <span className="text-3xl">{hoveredCategory.icon}</span>
                <div className="text-[11px] font-black text-slate-900 uppercase">{Math.round(hoveredCategory.percent)}%</div>
              </>
            ) : (
              <>
                <span className="text-[9px] font-black text-slate-300 uppercase">Total Dépenses</span>
                <span className="text-xl font-black text-slate-900">{Math.round(stats.expenses).toLocaleString('fr-FR')}€</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;