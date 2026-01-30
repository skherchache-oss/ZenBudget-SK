import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
// CORRECTION : Utilisation du package officiel
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
  transactions, categories, activeAccount, month, year, checkingAccountBalance, availableBalance, projectedBalance 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse de votre sérénité...");
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

  useEffect(() => {
    const fetchAiAdvice = async () => {
      // CORRECTION : Accès variable environnement Vite
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey) {
        setAiAdvice(availableBalance < 100 ? "Cultivez la patience, l'abondance viendra." : "Votre ciel financier est d'une clarté parfaite.");
        return;
      }

      setLoadingAdvice(true);
      try {
        // CORRECTION : Nouvelle syntaxe d'initialisation SDK
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `Tu es un coach financier Zen. Voici les données : Disponible ${availableBalance}€, Charges fixes ${stats.fixed}€, Dépenses variables ${stats.variable}€. Donne un seul conseil ultra-court (max 60 caractères), poétique et bienveillant en français. N'affiche aucun chiffre, sois inspirant et bref.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim().replace(/^["']|["']$/g, '');
        
        setAiAdvice(text || "La simplicité est la clé de la richesse intérieure.");
      } catch (err) { 
        console.error("AI Error:", err);
        setAiAdvice("Laissez vos économies respirer comme vous."); 
      } finally { 
        setLoadingAdvice(false); 
      }
    };
    
    const timer = setTimeout(fetchAiAdvice, 1500);
    return () => clearTimeout(timer);
  }, [availableBalance, stats.fixed, stats.variable]);

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
      `ZENBUDGET - BILAN${s}${activeAccount.name.toUpperCase()}`,
      `Période${s}${MONTHS_FR[month]} ${year}`,
      "",
      `Solde Bancaire${s}${f(checkingAccountBalance)} €`,
      `Disponible Réel${s}${f(availableBalance)} €`,
      `Projection Fin de Mois${s}${f(projectedBalance)} €`,
      "",
      "--- RÉPARTITION ---",
      `Catégorie${s}Montant${s}Part (%)`
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
  const sectionTitleStyle = "text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1 flex items-center gap-2 px-2";

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      <div className="flex items-center justify-between pt-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">Bilan ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1.5 truncate max-w-[140px]">{activeAccount.name}</p>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-3.5 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm text-[9px] font-black uppercase tracking-widest text-slate-500 active:scale-95 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV
        </button>
      </div>

      <div>
        <h2 className={sectionTitleStyle}><span>🏦</span> Solde Bancaire</h2>
        <div className="bg-slate-900 px-6 py-9 rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[130px]">
          <div className="absolute top-0 right-0 p-8 opacity-10"><svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2z"/></svg></div>
          <span className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Situation actuelle</span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tighter text-white">{Math.round(checkingAccountBalance).toLocaleString('fr-FR')}</span>
            <span className="text-xl font-black text-slate-500">€</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-lg shadow-indigo-100 flex flex-col gap-1 border border-indigo-500/20">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest">Disponible Réel</span>
          <div className="text-2xl font-black text-white">{Math.round(availableBalance).toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Fin de mois</span>
          <div className={`text-2xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{Math.round(projectedBalance).toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-200/50 to-emerald-200/50 rounded-[30px] blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
        <div className="relative bg-white/60 backdrop-blur-md p-5 rounded-[28px] flex items-center gap-4 border border-white shadow-sm overflow-hidden">
          <div className={`w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl shrink-0 transition-transform duration-1000 ${loadingAdvice ? 'animate-pulse scale-110' : 'scale-100'}`}>
            {loadingAdvice ? '💎' : '🧘'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[7px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1 leading-none">Intelligence Zen</span>
            <p className={`text-[12px] font-bold leading-tight text-slate-600 italic transition-all duration-700 ${loadingAdvice ? 'opacity-30 blur-[1px]' : 'opacity-100'}`}>
              "{aiAdvice}"
            </p>
          </div>
          {loadingAdvice && (
            <div className="absolute bottom-0 left-0 h-[2px] w-full bg-indigo-50 overflow-hidden">
              <div className="h-full bg-indigo-400 animate-[loading_2s_infinite]"></div>
            </div>
          )}
        </div>
      </div>

      <section>
        <h2 className={sectionTitleStyle}><span>🔄</span> Bilan des flux</h2>
        <div className="bg-white p-6 rounded-[36px] border border-slate-100 shadow-sm grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block">Entrées</span>
            <div className="text-xl font-black text-slate-800">+{Math.round(stats.income).toLocaleString('fr-FR')}€</div>
          </div>
          <div className="space-y-1 border-l border-slate-50 pl-6">
            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest block">Sorties</span>
            <div className="text-xl font-black text-slate-800">-{Math.round(stats.expenses).toLocaleString('fr-FR')}€</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className={sectionTitleStyle}><span>📊</span> Répartition</h2>
        <div className="bg-white p-6 rounded-[36px] border border-slate-100 shadow-sm space-y-6">
          <div className="w-full h-[180px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={categorySummary} cx="50%" cy="50%" innerRadius={60} outerRadius={82} paddingAngle={4} dataKey="value" stroke="none" 
                  onMouseEnter={(_: any, idx: number) => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {categorySummary.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.color} className="transition-all duration-300 outline-none" />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              {hoveredCategory ? (
                <>
                  <span className="text-2xl animate-bounce mb-1">{hoveredCategory.icon}</span>
                  <span className="text-[11px] font-black uppercase text-slate-900 tracking-tighter">{Math.round(hoveredCategory.percent)}%</span>
                </>
              ) : (
                <>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Sorties</span>
                  <span className="text-lg font-black text-slate-900">{Math.round(stats.expenses).toLocaleString('fr-FR')}€</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {categorySummary.slice(0, 5).map((item, idx) => (
              <div 
                key={item.id} 
                className={`flex items-center justify-between p-3.5 rounded-[22px] transition-all duration-300 border ${activeIndex === idx ? 'bg-indigo-50/50 border-indigo-100 scale-[1.02]' : 'bg-slate-50/50 border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">{item.icon}</div>
                  <div>
                    <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">{item.name}</div>
                    <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{Math.round(item.percent)}%</div>
                  </div>
                </div>
                <div className="text-[13px] font-black text-slate-900">{Math.round(item.value).toLocaleString('fr-FR')}€</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;