import React, { useMemo, useState } from 'react';
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

const ZEN_TIPS = [
  "La richesse est dans la gestion, pas dans la possession. 🌿",
  "Un petit flux devient une grande rivière. ✨",
  "La sérénité financière commence par un regard honnête. 🙏",
  "Dépensez pour ce qui a de la valeur, pas du prix. 💎"
];

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, categories, activeAccount, allAccounts, onSwitchAccount, checkingAccountBalance, availableBalance, projectedBalance, month, year 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>(ZEN_TIPS[0]);

  const stats = useMemo(() => {
    let income = 0, expenses = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expenses += t.amount;
    });
    return { income, expenses };
  }, [transactions]);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    const expenseTs = transactions.filter(t => t.type === 'EXPENSE');
    expenseTs.forEach(t => { map[t.categoryId] = (map[t.categoryId] || 0) + t.amount; });
    const total = stats.expenses || 1;
    return Object.entries(map).map(([id, value]) => {
      const cat = categories.find(c => c.id === id);
      return { id, name: cat?.name || 'Autres', value, color: cat?.color || '#94a3b8', icon: cat?.icon || '📦', percent: (value / total) * 100 };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories, stats.expenses]);

  const handleExportCSV = () => {
    const s = ";";
    const rows = [`ZENBUDGET - EXPORT ${activeAccount.name.toUpperCase()}`, `Date${s}Categorie${s}Type${s}Montant`];
    transactions.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      rows.push(`${new Date(t.date).toLocaleDateString('fr-FR')}${s}${cat?.name || 'Autre'}${s}${t.type}${s}${t.amount.toFixed(2)}`);
    });
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ZenBudget_${activeAccount.name}.csv`;
    link.click();
  };

  const formatVal = (v: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(v);

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black italic text-slate-800">Bilan Zen ✨</h2>
          <button onClick={() => allAccounts.length > 1 && onSwitchAccount(allAccounts[(allAccounts.findIndex(a => a.id === activeAccount.id) + 1) % allAccounts.length].id)} className="text-[10px] font-black uppercase text-indigo-500 text-left">{activeAccount.name}</button>
        </div>
        <button onClick={handleExportCSV} className="px-4 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV
        </button>
      </div>

      <div className="bg-slate-900 px-6 py-9 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <span className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em]">Solde Bancaire</span>
        <div className="text-4xl font-black mt-1 tracking-tighter">{formatVal(checkingAccountBalance)}€</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`p-5 rounded-[32px] shadow-lg ${availableBalance < 0 ? 'bg-red-500' : 'bg-indigo-600'} text-white transition-colors`}>
          <span className="text-[8px] font-black uppercase opacity-70 block mb-1">Disponible Réel</span>
          <div className="text-xl font-black">{formatVal(availableBalance)}€</div>
        </div>
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
          <span className="text-slate-400 text-[8px] font-black uppercase block mb-1">Projection Fin</span>
          <div className={`text-xl font-black ${projectedBalance < 0 ? 'text-red-500' : 'text-slate-900'}`}>{formatVal(projectedBalance)}€</div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md p-5 rounded-[28px] flex items-center gap-4 border border-white shadow-sm active:scale-[0.98] cursor-pointer" onClick={() => setAiAdvice(ZEN_TIPS[Math.floor(Math.random()*ZEN_TIPS.length)])}>
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl">💡</div>
        <p className="text-[11px] font-bold text-slate-700 leading-tight">{aiAdvice}</p>
      </div>

      {categorySummary.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-[40px] p-6 border border-white shadow-xl">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Répartition des dépenses</h3>
          <div className="h-[200px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categorySummary} innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                  {categorySummary.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] font-black uppercase text-slate-400">Sorties</span>
              <span className="text-xl font-black text-slate-900">{formatVal(stats.expenses)}€</span>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            {categorySummary.map(cat => (
              <div key={cat.id} className="flex items-center gap-3 p-2 bg-slate-50/50 rounded-2xl">
                <span className="text-xl w-8 text-center">{cat.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] font-black uppercase text-slate-800">
                    <span>{cat.name}</span>
                    <span>{formatVal(cat.value)}€</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;