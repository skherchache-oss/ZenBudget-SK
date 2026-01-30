
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { GoogleGenAI } from "@google/genai";
import { IconExport } from './Icons';

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
  transactions, categories, activeAccount, allAccounts, onSwitchAccount, month, year, checkingAccountBalance, availableBalance, projectedBalance 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse zen...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const cycleDay = activeAccount?.cycleEndDay || 0;
  const projectionLabel = cycleDay > 0 ? `Solde au ${cycleDay}` : `Fin de mois (${MONTHS_FR[month]})`;

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
      if (!process.env.API_KEY) {
        setAiAdvice(projectedBalance < 0 ? "Attention au solde projeté fin de cycle." : "Gestion sereine ce mois-ci.");
        return;
      }
      setLoadingAdvice(true);
      try {
        // Initialize Gemini client with process.env.API_KEY directly in the named parameter object
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `ZenBudget: Compte courant ${checkingAccountBalance}€, Fin de mois ${projectedBalance}€, Disponible ${availableBalance}€. Fixes ${stats.fixed}€. Donne 1 conseil zen très court (50 car max, français).`;
        const response = await ai.models.generateContent({ 
          model: 'gemini-3-flash-preview', 
          contents: prompt 
        });
        // Accessing the .text property directly from GenerateContentResponse
        setAiAdvice(response.text || "La discipline offre la liberté.");
      } catch (err) { setAiAdvice("Observez vos flux sans jugement."); }
      finally { setLoadingAdvice(false); }
    };
    fetchAiAdvice();
  }, [projectedBalance, checkingAccountBalance, availableBalance, stats]);

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
    const s = ";"; // Séparateur point-virgule pour Excel FR
    const f = (n: number) => n.toFixed(2).replace('.', ','); // Formatage monétaire FR
    
    const rows = [];
    
    // 1. Branding & Période
    rows.push(["ZENBUDGET - RAPPORT FINANCIER"]);
    rows.push([`Compte: ${activeAccount.name}${s}Periode: ${MONTHS_FR[month]} ${year}`]);
    rows.push([]);

    // 2. Section: Tableau de bord
    rows.push(["SECTION: TABLEAU DE BORD"]);
    rows.push([`Compte Courant (Solde actuel)${s}${f(checkingAccountBalance)} €`]);
    rows.push([`Disponible Reel (Apres charges)${s}${f(availableBalance)} €`]);
    rows.push([`Projection Fin de Mois${s}${f(projectedBalance)} €`]);
    rows.push([]);

    // 3. Section: Analyse des Flux
    rows.push(["SECTION: ANALYSE DES FLUX"]);
    rows.push([`Total Revenus (+)${s}${f(stats.income)} €`]);
    rows.push([`Total Depenses (-)${s}${f(stats.expenses)} €`]);
    rows.push([`Capacite d'Epargne Mensuelle${s}${f(stats.net)} €`]);
    rows.push([`-- Dont charges fixes${s}${f(stats.fixed)} €`]);
    rows.push([]);

    // 4. Section: Repartition par Categorie
    rows.push(["SECTION: DEPENSES PAR CATEGORIE"]);
    rows.push([`CATEGORIE${s}MONTANT${s}PART (%)`]);
    categorySummary.forEach(cat => {
      rows.push([`${cat.name}${s}${f(cat.value)} €${s}${Math.round(cat.percent)}%`]);
    });
    rows.push([]);

    // 5. Section: Journal Detaille
    rows.push(["SECTION: JOURNAL DES OPERATIONS"]);
    rows.push([`DATE${s}CATEGORIE${s}TYPE${s}MONTANT${s}FIXE${s}NOTE / COMMENTAIRE`]);
    
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sorted.forEach(t => {
      const catName = categories.find(c => c.id === t.categoryId)?.name || 'Inconnue';
      const date = new Date(t.date).toLocaleDateString('fr-FR');
      const amount = (t.type === 'INCOME' ? '' : '-') + f(t.amount);
      const isFixed = t.isRecurring ? 'OUI' : 'NON';
      const note = (t.comment || '').replace(/;/g, ','); // Eviter de casser le CSV
      rows.push([`${date}${s}${catName}${s}${t.type}${s}${amount} €${s}${isFixed}${s}${note}`]);
    });

    rows.push([]);
    rows.push([`Genere le ${new Date().toLocaleString('fr-FR')} par ZenBudget.`]);

    // Assemblage du CSV avec BOM UTF-8 (\uFEFF) pour le support complet des accents et d'Excel
    const csvContent = "\uFEFF" + rows.map(r => r.join('')).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const fileName = `ZenBudget_${activeAccount.name}_${MONTHS_FR[month]}_${year}.csv`.replace(/\s+/g, '_');
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hoveredCategory = activeIndex !== null ? categorySummary[activeIndex] : null;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-24 px-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Account Switcher & Actions */}
      <div className="flex items-center justify-between shrink-0">
        <div className="relative">
          <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="flex items-center gap-2.5 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-all">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeAccount.color }} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">{activeAccount.name}</span>
            <svg className={`w-3 h-3 text-slate-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showAccountMenu && (
            <div className="absolute top-12 left-0 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[70] animate-in zoom-in-95 duration-200">
              {allAccounts.map(acc => (
                <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setShowAccountMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} /> {acc.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={handleExportCSV}
          title="Exporter les données au format CSV"
          className="flex items-center gap-2 bg-indigo-600 px-4 py-2 rounded-2xl shadow-lg shadow-indigo-100 active:scale-95 transition-all text-white hover:bg-indigo-700"
        >
          <IconExport className="w-3.5 h-3.5" />
          <span className="text-[9px] font-black uppercase tracking-widest">Export CSV</span>
        </button>
      </div>

      {/* 1. LES CHIFFRES CLÉS */}
      <div className="grid grid-cols-1 gap-4 shrink-0">
        <div className="bg-slate-900 p-7 rounded-[40px] shadow-2xl relative overflow-hidden ring-1 ring-white/10">
          <div className="relative z-10">
            <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] block mb-1">Compte courant</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter text-white leading-none">{Math.round(checkingAccountBalance).toLocaleString('fr-FR')}</span>
              <span className="text-2xl font-black text-slate-600">€</span>
            </div>
          </div>
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-2">Disponible réel</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black leading-none ${availableBalance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{Math.round(availableBalance).toLocaleString('fr-FR')}</span>
              <span className="text-xs font-black text-slate-300">€</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-2">{projectionLabel}</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black leading-none ${projectedBalance >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{Math.round(projectedBalance).toLocaleString('fr-FR')}</span>
              <span className="text-xs font-black text-slate-300">€</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BLOCS FLUX */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Entrées</span>
          <div className="text-lg font-black text-emerald-600">+{stats.income.toLocaleString('fr-FR')}€</div>
        </div>
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm text-right">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sorties</span>
          <div className="text-lg font-black text-slate-900">-{stats.expenses.toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      {/* 3. CONSEIL AI */}
      <div className="bg-indigo-600 text-white p-6 rounded-[32px] shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[90px]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <h4 className="font-black text-[9px] uppercase tracking-[0.3em] text-indigo-200">Conseil Zen</h4>
        </div>
        <p className={`text-[13px] font-medium italic text-indigo-50 leading-tight transition-opacity ${loadingAdvice ? 'opacity-30' : 'opacity-100'}`}>"{aiAdvice}"</p>
      </div>

      {/* 4. GRAPHIQUE & RÉPARTITION */}
      <div className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm shrink-0 space-y-6">
        <div className="w-full h-[200px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {/* @ts-ignore: Prop activeIndex is missing from Recharts types in this environment, suppressing the error to allow the highlight feature */}
              <Pie 
                activeIndex={activeIndex === null ? undefined : activeIndex} 
                activeShape={renderActiveShape} 
                data={categorySummary} 
                cx="50%" cy="50%" 
                innerRadius={65} outerRadius={80} 
                paddingAngle={5} dataKey="value" 
                stroke="none" 
                onMouseEnter={(_, idx) => setActiveIndex(idx)} 
                onMouseLeave={() => setActiveIndex(null)}
              >
                {categorySummary.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.color} style={{ outline: 'none' }} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hoveredCategory ? (
              <div className="text-center animate-in zoom-in duration-300">
                <span className="text-4xl leading-none">{hoveredCategory.icon}</span>
                <div className="text-[11px] font-black text-slate-900 mt-1 uppercase tracking-tighter">{Math.round(hoveredCategory.percent)}%</div>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[9px] font-black text-slate-300 uppercase block tracking-widest">Dépenses</span>
                <span className="text-lg font-black text-slate-900">{Math.round(stats.expenses).toLocaleString('fr-FR')}€</span>
              </div>
            )}
          </div>
        </div>

        {/* Liste détaillée */}
        <div className="space-y-3 pt-4 border-t border-slate-50">
          <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1">Répartition des dépenses</h3>
          {categorySummary.length > 0 ? categorySummary.map((cat, idx) => (
            <div 
              key={cat.id} 
              className={`flex items-center gap-4 p-3 rounded-2xl transition-all ${activeIndex === idx ? 'bg-slate-50 scale-[1.02]' : 'hover:bg-slate-50/50'}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{cat.name}</span>
                  <span className="text-[11px] font-black text-slate-900">{Math.round(cat.value).toLocaleString('fr-FR')}€</span>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
              <div className="text-[9px] font-black text-slate-300 w-8 text-right">
                {Math.round(cat.percent)}%
              </div>
            </div>
          )) : (
            <div className="py-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Aucune dépense enregistrée</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
