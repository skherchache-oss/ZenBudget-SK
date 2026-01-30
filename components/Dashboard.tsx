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
  
  // Réf pour éviter les appels API Gemini en boucle
  const lastAdviceKey = useRef<string>("");

  // 1. Calcul des statistiques de base
  const stats = useMemo(() => {
    let income = 0, expenses = 0, fixed = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else {
        expenses += t.amount;
        if (t.isRecurring) fixed += t.amount;
      }
    });
    return { 
      income, 
      expenses, 
      fixed, 
      variable: expenses - fixed, 
      net: income - expenses 
    };
  }, [transactions]);

  // 2. Gestion de l'IA Gemini avec protection anti-boucle
  useEffect(() => {
    const fetchAiAdvice = async () => {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      // On crée une clé basée sur le mois et le solde (arrondi à 10€ près)
      const currentKey = `${month}-${year}-${Math.round(availableBalance / 10)}`;
      
      // Si la clé n'a pas changé, on ne relance pas l'IA
      if (lastAdviceKey.current === currentKey) return;

      if (!apiKey) {
        setAiAdvice(availableBalance < 100 ? "Prévoyez une marge pour les imprévus." : "Votre disponible est confortable, savourez l'instant.");
        return;
      }

      setLoadingAdvice(true);
      try {
        const genAI = new GoogleGenAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `ZenBudget: Bancaire ${checkingAccountBalance}€, Disponible ${availableBalance}€, Fixes ${stats.fixed}€, Variables ${stats.variable}€. Donne 1 conseil bienveillant et zen très court (50 car max, français). Pas de chiffres.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        
        setAiAdvice(text || "La clarté apporte la sérénité.");
        lastAdviceKey.current = currentKey; // Mémorisation du succès
      } catch (err) { 
        console.error("Erreur Gemini:", err);
        setAiAdvice("Observez vos flux sans jugement."); 
      } finally { 
        setLoadingAdvice(false); 
      }
    };

    // Délai de courtoisie pour laisser le state se stabiliser au montage
    const timer = setTimeout(fetchAiAdvice, 1500);
    return () => clearTimeout(timer);
  }, [month, year, availableBalance, checkingAccountBalance, stats.fixed, stats.variable]);

  // 3. Résumé par catégorie pour le graphique
  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    const total = stats.expenses || 1;
    return Object.entries(map).map(([id, value]) => {
      const cat = categories.find(c => c.id === id);
      return { 
        id, 
        name: cat?.name || 'Autres', 
        value, 
        color: cat?.color || '#94a3b8', 
        icon: cat?.icon || '📦', 
        percent: (value / total) * 100 
      };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories, stats.expenses]);

  const handleExportCSV = () => {
    const s = ";"; 
    const f = (n: number) => Math.round(n).toString().replace('.', ','); 
    const rows: string[] = [];
    
    rows.push("ZENBUDGET - EXPORT CSV");
    rows.push(`Compte: ${activeAccount.name}${s}Periode: ${MONTHS_FR[month]} ${year}`);
    rows.push("");
    rows.push("SECTION: SYNTHESE DES SOLDES");
    rows.push(`Report mois precedent${s}${f(carryOver)} €`);
    rows.push(`Solde Bancaire (Actuel)${s}${f(checkingAccountBalance)} €`);
    rows.push(`Disponible Reel (Apres charges)${s}${f(availableBalance)} €`);
    rows.push(`Projection Fin de Mois${s}${f(projectedBalance)} €`);
    rows.push("");
    rows.push("DATE${s}CATEGORIE${s}TYPE${s}MONTANT${s}SOLDE CUMULE${s}FIXE${s}NOTES");
    
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = carryOver;
    sorted.forEach(t => {
      const catName = categories.find(c => c.id === t.categoryId)?.name || 'Inconnue';
      const amt = t.type === 'INCOME' ? t.amount : -t.amount;
      running += amt;
      const note = (t.comment || '').replace(/;/g, ',').replace(/"/g, "'");
      rows.push(`${new Date(t.date).toLocaleDateString('fr-FR')}${s}${catName}${s}${t.type}${s}${f(t.amount)} €${s}${f(running)} €${s}${t.isRecurring?'OUI':'NON'}${s}"${note}"`);
    });
    
    const csvString = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ZenBudget_${activeAccount.name}_${MONTHS_FR[month]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-24 px-1">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">Hello ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1 truncate max-w-[150px]">
            {activeAccount.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="px-3 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm text-[9px] font-black uppercase tracking-widest text-slate-500 active:scale-95 transition-all">
            Export CSV
          </button>
          <div className="relative">
            <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-2xl border border-slate-100 shadow-sm active:scale-95">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeAccount.color }} />
            </button>
            {showAccountMenu && (
              <div className="absolute top-14 right-0 w-48 bg-white rounded-[24px] shadow-2xl border border-slate-100 py-2 z-[70]">
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

      {/* MAIN BALANCE CARD */}
      <div className="bg-slate-900 px-6 py-8 rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col justify-center">
        <div className="relative z-10 flex flex-col gap-1">
          <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Solde Bancaire</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-black tracking-tighter text-white">
              {Math.round(checkingAccountBalance).toLocaleString('fr-FR')}
            </span>
            <span className="text-xl font-black text-slate-500">€</span>
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-500/15 rounded-full blur-[60px] pointer-events-none" />
      </div>

      {/* SUB-BALANCES */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-xl flex flex-col gap-2">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest">Disponible Réel</span>
          <div className="text-2xl font-black text-white">{Math.round(availableBalance).toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-2">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Fin de mois</span>
          <div className={`text-2xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{Math.round(projectedBalance).toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      {/* AI ADVICE */}
      <div className="bg-slate-100 p-5 rounded-[28px] flex items-center gap-4 border border-white">
        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl shrink-0">🧘</div>
        <p className={`text-[11px] font-medium leading-tight text-slate-600 italic transition-opacity ${loadingAdvice ? 'opacity-30' : 'opacity-100'}`}>
          "{aiAdvice}"
        </p>
      </div>

      {/* CHARTS SECTION */}
      <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
        <div className="w-full h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={categorySummary} 
                cx="50%" cy="50%" 
                innerRadius={60} outerRadius={80} 
                paddingAngle={4} dataKey="value" 
                stroke="none"
                activeIndex={activeIndex === null ? -1 : activeIndex}
                activeShape={renderActiveShape}
                onMouseEnter={(_: any, idx: number) => setActiveIndex(idx)} 
                onMouseLeave={() => setActiveIndex(null)}
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
                <span className="text-[9px] font-black text-slate-300 uppercase">Dépenses</span>
                <span className="text-lg font-black text-slate-900">{Math.round(stats.expenses).toLocaleString('fr-FR')}€</span>
              </div>
            )}
          </div>
        </div>

        {/* TOP CATEGORIES LIST */}
        <div className="space-y-2 pt-4 border-t border-slate-50">
          {categorySummary.slice(0, 5).map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>{cat.icon}</div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-[12px] font-black text-slate-700 uppercase tracking-tight">{cat.name}</span>
                  <span className="text-[12px] font-black text-slate-900">{Math.round(cat.value).toLocaleString('fr-FR')}€</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
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