import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { GoogleGenerativeAI } from "@google/generative-ai"; // Correction de l'import
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';

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
    return { income, expenses, fixed, variable: expenses - fixed };
  }, [transactions]);

  useEffect(() => {
    const fetchAiAdvice = async () => {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const currentKey = `${month}-${year}-${Math.round(availableBalance / 10)}`;
      
      if (lastAdviceKey.current === currentKey) return;

      if (!apiKey || apiKey === "PLACEHOLDER_API_KEY") {
        setAiAdvice(availableBalance < 100 ? "Prévoyez une marge pour les imprévus." : "Votre disponible est confortable.");
        return;
      }

      setLoadingAdvice(true);
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `ZenBudget: Bancaire ${checkingAccountBalance}€, Disponible ${availableBalance}€, Fixes ${stats.fixed}€. Conseil bienveillant très court (50 car max). Pas de chiffres.`;
        
        const result = await model.generateContent(prompt);
        // Correction ici : .text() est une fonction directe sur response
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
  }, [month, year, availableBalance, checkingAccountBalance, stats.fixed]);

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
    const f = (n: number) => Math.round(n).toString();
    const rows = [
      `Compte: ${activeAccount.name}${s}Periode: ${MONTHS_FR[month]} ${year}`,
      `Bancaire${s}${f(checkingAccountBalance)}`,
      `Disponible${s}${f(availableBalance)}`,
      ""
    ];
    const csvString = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ZenBudget_${activeAccount.name}.csv`;
    link.click();
  };

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-24 px-1">
      <div className="flex items-center justify-between pt-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Hello ✨</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1">{activeAccount.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="px-3 py-2 bg-white rounded-xl border border-slate-100 text-[9px] font-black uppercase">Export</button>
          <div className="relative">
            <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeAccount.color }} />
            </button>
            {showAccountMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-2">
                {allAccounts.map(acc => (
                  <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                    <span className="text-xs font-bold">{acc.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 px-6 py-8 rounded-[40px] shadow-2xl relative overflow-hidden">
        <span className="text-indigo-400 text-[10px] font-black uppercase tracking-widest opacity-80">Solde Bancaire</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-5xl font-black text-white">{Math.round(checkingAccountBalance).toLocaleString('fr-FR')}</span>
          <span className="text-xl font-black text-slate-500">€</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600 p-5 rounded-[32px] shadow-xl">
          <span className="text-indigo-200 text-[8px] font-black uppercase tracking-widest">Disponible Réel</span>
          <div className="text-2xl font-black text-white">{Math.round(availableBalance).toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100">
          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Fin de mois</span>
          <div className="text-2xl font-black text-slate-900">{Math.round(projectedBalance).toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      <div className="bg-slate-100 p-5 rounded-[28px] flex items-center gap-4 border border-white">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shrink-0">🧘</div>
        <p className={`text-[11px] font-medium text-slate-600 italic ${loadingAdvice ? 'opacity-30' : ''}`}>"{aiAdvice}"</p>
      </div>

      <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm">
        <div className="w-full h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={categorySummary} cx="50%" cy="50%" innerRadius={60} outerRadius={80} 
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
                <span className="text-2xl">{hoveredCategory.icon}</span>
                <div className="text-[10px] font-black uppercase">{Math.round(hoveredCategory.percent)}%</div>
              </>
            ) : (
              <>
                <span className="text-[8px] font-black text-slate-300 uppercase">Dépenses</span>
                <span className="text-lg font-black">{Math.round(stats.expenses).toLocaleString('fr-FR')}€</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;