import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
// CORRECTION : Utilisation du nom de package aligné avec l'importmap
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
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse de votre budget en cours...");
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
    // CORRECTION : Utilisation de import.meta.env pour Vite/Vercel
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      setAiAdvice("Conseil : Pensez à mettre de côté 10% de vos revenus dès le début du mois.");
      return;
    }

    setLoadingAdvice(true);
    try {
      // CORRECTION : Mise à jour vers la syntaxe SDK officielle
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const randomSeed = Math.random().toString(36).substring(7);
      
      const prompt = `Tu es un expert en finances personnelles. Analyse ces données :
        - Reste à dépenser : ${availableBalance}€
        - Dépenses totales ce mois : ${stats.expenses}€
        - Revenus : ${stats.income}€
        
        MISSION :
        Donne un UNIQUE conseil financier PRATIQUE et DIRECT.
        Le conseil doit aider à mieux gérer son argent, épargner ou éviter des d'épenses inutiles.
        
        CONTRAINTES :
        - Style : Clair, simple, professionnel, sans métaphore.
        - Longueur : Maximum 65 caractères.
        - Thèmes : Épargne de précaution, budget variable, factures, investissement simple.
        - Pas de "Maître Zen", pas de poésie. Juste de la finance.
        - Pas de chiffres précis dans le conseil.
        - Langue : Français uniquement.
        - Graine : ${randomSeed}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim().replace(/^["']|["']$/g, '');
      
      if (text && text.length > 5) {
        setAiAdvice(text);
      }
    } catch (err) { 
      console.error("Erreur IA:", err);
      setAiAdvice("Conseil : Vérifiez vos abonnements inutilisés pour réduire vos charges fixes."); 
    } finally { 
      setLoadingAdvice(false); 
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchAiAdvice, 800);
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
    const s = ";"; 
    const f = (n: number) => n.toFixed(2).replace('.', ',');
    const rows: string[] = [
      `ZENBUDGET - BILAN${s}${activeAccount.name.toUpperCase()}`,
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
  const sectionTitleStyle = "text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-2 px-2";

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      <div className="flex items-center justify-between pt-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">Bilan ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1.5 truncate max-w-[140px]">{activeAccount.name}</p>
        </div>
        <button onClick={handleExportCSV} className="px-4 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm text-[9px] font-black uppercase tracking-widest text-slate-500 active:scale-95 transition-all">
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

      <div className="relative group cursor-pointer" onClick={fetchAiAdvice}>
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-200 to-blue-200 rounded-[30px] blur opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative bg-white/70 backdrop-blur-md p-5 rounded-[28px] flex items-center gap-4 border border-white shadow-sm overflow-hidden active:scale-[0.98] transition-all">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl shadow-inner shrink-0 relative">
            {loadingAdvice ? (
              <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : "💡"}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-500 block mb-1">Analyse Intelligente</span>
            <p className="text-[11px] font-bold text-slate-700 leading-tight">
              {aiAdvice}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-[40px] p-6 border border-white shadow-xl">
        <h2 className={sectionTitleStyle}><span>📊</span> Répartition des dépenses</h2>
        <div className="h-[240px] w-full mt-4 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categorySummary}
                innerRadius={75}
                outerRadius={100}
                paddingAngle={8}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                stroke="none"
              >
                {categorySummary.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} opacity={activeIndex === null || activeIndex === index ? 1 : 0.3} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hoveredCategory ? (
              <>
                <span className="text-2xl mb-1">{hoveredCategory.icon}</span>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{hoveredCategory.name}</span>
                <span className="text-lg font-black text-slate-900">{Math.round(hoveredCategory.value)}€</span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Total</span>
                <span className="text-2xl font-black text-slate-900">{Math.round(stats.expenses)}€</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-6">
          {categorySummary.slice(0, 4).map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm border border-slate-100 text-sm">{cat.icon}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black uppercase tracking-tight text-slate-800 truncate">{cat.name}</span>
                <span className="text-[10px] font-black text-slate-400">{Math.round(cat.percent)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;