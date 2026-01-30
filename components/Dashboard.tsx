import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { MONTHS_FR } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
// IMPORT CORRIGÉ POUR VERCEL
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
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const currentKey = `${month}-${year}-${Math.round(availableBalance / 10)}`;
      if (lastAdviceKey.current === currentKey) return;
      
      if (!apiKey) {
        setAiAdvice(availableBalance < 100 ? "Prévoyez une marge pour les imprévus." : "Votre disponible est confortable, savourez l'instant.");
        return;
      }

      setLoadingAdvice(true);
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `ZenBudget: Bancaire ${checkingAccountBalance}€, Disponible ${availableBalance}€, Fixes ${stats.fixed}€. Donne 1 conseil bienveillant et zen très court (50 car max, français). Pas de chiffres.`;
        
        const result = await model.generateContent(prompt);
        setAiAdvice(result.response.text().trim() || "La clarté apporte la sérénité.");
        lastAdviceKey.current = currentKey;
      } catch (err) { 
        setAiAdvice("Observez vos flux sans jugement."); 
      } finally { 
        setLoadingAdvice(false); 
      }
    };
    const timer = setTimeout(fetchAiAdvice, 1000);
    return () => clearTimeout(timer);
  }, [month, year, availableBalance, checkingAccountBalance, stats.fixed]);

  // Reste du code du Dashboard (Export CSV, Charts...) identique à ta version
  // ... (Code non modifié pour la suite)

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
       {/* Tes sections de Dashboard ici */}
       <div className="flex items-center justify-between pt-4">
         <div className="flex flex-col">
           <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">Hello ✨</h2>
           <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1">{activeAccount.name}</p>
         </div>
       </div>
       {/* ... suite du dashboard */}
    </div>
  );
};

export default Dashboard;