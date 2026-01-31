import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
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
  transactions, 
  categories, 
  activeAccount, 
  checkingAccountBalance, 
  availableBalance, 
  projectedBalance 
}) => {
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse des flux en cours...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // 1. Calcul des statistiques du mois affiché (Basé sur effectiveTransactions d'App.tsx)
  const stats = useMemo(() => {
    let income = 0;
    let expenses = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expenses += t.amount;
    });
    return { income, expenses, net: income - expenses };
  }, [transactions]);

  // 2. IA - Conseil financier (Sécurisé pour Vercel)
  const fetchAiAdvice = async () => {
    // Vercel utilise process.env.NEXT_PUBLIC_... ou injecte via l'UI. 
    // On vérifie plusieurs sources possibles pour la clé API.
    const apiKey = (window as any).process?.env?.API_KEY || (window as any).process?.env?.NEXT_PUBLIC_API_KEY;
    
    if (!apiKey) {
      setAiAdvice("Conseil : Maintenez une épargne de sécurité de 10% de vos revenus.");
      return;
    }

    setLoadingAdvice(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Tu es un expert financier. Analyse : Solde ${availableBalance}€, Revenus ${stats.income}€, Dépenses ${stats.expenses}€. 
      Donne 1 conseil concret (max 65 car.). Ton direct, pas de politesse.`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      setAiAdvice(text.trim().substring(0, 65));
    } catch (err) {
      setAiAdvice("Conseil : Surveillez vos abonnements inutilisés pour optimiser le solde.");
    } finally {
      setLoadingAdvice(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchAiAdvice, 1000);
    return () => clearTimeout(timer);
  }, [availableBalance]);

  // 3. Répartition par catégorie
  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    
    return Object.entries(map).map(([id, value]) => {
      const cat = categories.find(c => c.id === id);
      const total = stats.expenses || 1;
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

  const sectionTitleStyle = "text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2 px-2";

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1">
      {/* Header Bilan */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">Bilan ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1.5">{activeAccount.name}</p>
        </div>
      </div>

      {/* Solde Bancaire Principal */}
      <div>
        <h2 className={sectionTitleStyle}><span>🏦</span> Solde Bancaire Actuel</h2>
        <div className="bg-slate-900 px-6 py-9 rounded-[40px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2z"/></svg>
          </div>
          <span className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1 block">Pointé en banque</span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tighter text-white">
              {Math.round(checkingAccountBalance).toLocaleString('fr-FR')}
            </span>
            <span className="text-xl font-black text-slate-500">€</span>
          </div>
        </div>
      </div>

      {/* Grille de Projection */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-lg shadow-indigo-100 flex flex-col gap-1 border border-indigo-500/20">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest">Disponible Réel</span>
          <div className="text-2xl font-black text-white">
            {Math.round(availableBalance).toLocaleString('fr-FR')}€
          </div>
          <p className="text-[7px] text-indigo-300 font-bold uppercase tracking-tight leading-tight">Après toutes charges du mois</p>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Projection Fin de mois</span>
          <div className={`text-2xl font-black ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>
            {Math.round(projectedBalance).toLocaleString('fr-FR')}€
          </div>
          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tight leading-tight">Total estimé au 30/31</p>
        </div>
      </div>

      {/* Widget IA */}
      <div className="relative group">
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-[28px] flex items-center gap-4 border border-white shadow-sm transition-all">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
            {loadingAdvice ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : "💡"}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-500 block mb-0.5">Expert Trésorerie</span>
            <p className="text-[11px] font-bold text-slate-700 leading-tight truncate">{aiAdvice}</p>
          </div>
        </div>
      </div>

      {/* Liste des catégories */}
      <div>
        <h2 className={sectionTitleStyle}><span>📊</span> Répartition des dépenses</h2>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm space-y-3">
          {categorySummary.length > 0 ? (
            categorySummary.slice(0, 5).map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-800 tracking-tight">{cat.name}</span>
                    <div className="w-20 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-black text-slate-900">{Math.round(cat.value)}€</div>
                  <div className="text-[8px] font-black text-slate-400 uppercase">{Math.round(cat.percent)}%</div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
              Aucune dépense ce mois-ci
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;