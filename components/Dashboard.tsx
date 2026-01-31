
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
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

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, categories, activeAccount, checkingAccountBalance, availableBalance, projectedBalance 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse de votre trésorerie...");
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
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setAiAdvice("Conseil : Conservez une épargne de sécurité égale à 3 mois de dépenses fixes.");
      return;
    }

    setLoadingAdvice(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const randomSeed = Math.random().toString(36).substring(7);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tu es un expert en gestion de trésorerie et finances personnelles.
        Données actuelles :
        - Solde disponible : ${availableBalance}€
        - Dépenses totales identifiées : ${stats.expenses}€
        - Revenus prévus : ${stats.income}€
        
        MISSION :
        Donne un conseil financier UNIQUE, PRAGMATIQUE et CONCRET.
        Le ton doit être celui d'un expert-comptable moderne : direct et utile.
        
        CONTRAINTES :
        - Style : Professionnel, sans fioritures.
        - Longueur : Maximum 65 caractères.
        - Interdit : Pas de poésie, pas de ton "Zen", pas de métaphores.
        - Focus : Épargne, flux de trésorerie ou réduction de charges fixes.
        - Langue : Français uniquement.
        - Graine : ${randomSeed}`,
      });
      
      const text = response.text?.trim().replace(/^["']|["']$/g, '');
      if (text && text.length > 5) {
        setAiAdvice(text);
      }
    } catch (err) { 
      setAiAdvice("Conseil : Vérifiez vos prélèvements automatiques pour optimiser votre solde mensuel."); 
    } finally { 
      setLoadingAdvice(false); 
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchAiAdvice, 1000);
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
      `ZENBUDGET - EXPORT CSV${s}${activeAccount.name.toUpperCase()}`,
      "",
      `Solde Bancaire Actuel${s}${f(checkingAccountBalance)} €`,
      `Disponible Réel (après fixes)${s}${f(availableBalance)} €`,
      `Projection Fin de Mois${s}${f(projectedBalance)} €`,
      "",
      "--- RÉPARTITION PAR CATÉGORIE ---",
      `Catégorie${s}Montant (€)${s}Part (%)`
    ];
    categorySummary.forEach(c => {
      rows.push(`${c.name}${s}${f(c.value)}${s}${Math.round(c.percent)}%`);
    });
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `ZenBudget_Export_${activeAccount.name.replace(/\s+/g, '_')}.csv`; link.click();
  };

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
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-[30px] blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
        <div className="relative bg-white/80 backdrop-blur-md p-5 rounded-[28px] flex items-center gap-4 border border-white shadow-sm overflow-hidden active:scale-[0.98] transition-all">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl shadow-inner shrink-0">
            {loadingAdvice ? (
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            ) : "💡"}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-500 block mb-1">Expert Financier</span>
            <p className="text-[11px] font-bold text-slate-700 leading-tight">
              {aiAdvice}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className={sectionTitleStyle}><span>📊</span> Répartition des charges</h2>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          {categorySummary.length > 0 ? (
            <div className="space-y-4">
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySummary}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {categorySummary.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" opacity={activeIndex === null || activeIndex === index ? 1 : 0.6} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                {categorySummary.slice(0, 5).map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100/50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{cat.icon}</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-slate-800 tracking-tight">{cat.name}</span>
                        <div className="w-24 h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-black text-slate-900">{Math.round(cat.value).toLocaleString('fr-FR')}€</div>
                      <div className="text-[8px] font-black text-slate-400 uppercase">{Math.round(cat.percent)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
              Aucune donnée à analyser
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
