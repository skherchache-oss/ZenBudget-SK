import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Transaction, Category, BudgetAccount, Project } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, RefreshCw, AlertCircle, MessageSquareHeart, Target, Plus, Pencil, Trash2, Trophy, Star, Send, X } from 'lucide-react';
import { MONTHS_FR } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

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
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  firstInstallDate?: string;
  hasGivenFeedback?: boolean;
  onGiveFeedback?: (data: any) => void;
  onAddProject?: () => void;
  onEditProject?: (p: Project) => void;
  onDeleteProject?: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions = [], categories = [], activeAccount, allAccounts = [],
  onSwitchAccount, checkingAccountBalance, availableBalance, projectedBalance, carryOver,
  month, year, onPrevMonth, onNextMonth,
  firstInstallDate, hasGivenFeedback, onGiveFeedback, 
  onAddProject, onEditProject, onDeleteProject
}) => {
  const [aiAdvice, setAiAdvice] = useState<string>("Votre sérénité est votre meilleur investissement. ✨");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  
  const [premiumType, setPremiumType] = useState<'CSV' | 'PROJECTS' | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  
  const [feedbackStep, setFeedbackStep] = useState<'RATING' | 'FEATURES'>('RATING');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const menuRef = useRef<HTMLDivElement>(null);
  const currentDate = useMemo(() => new Date(year, month), [year, month]);

  // GESTION DU FOCUS ET DU SCROLL BODY
  useEffect(() => {
    const isModalOpen = !!premiumType || showFeedbackModal;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [premiumType, showFeedbackModal]);

  const handleFullAppRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => { window.location.reload(); }, 500);
  };

  const handleSendFeedback = () => {
    onGiveFeedback?.({
      rating: userRating,
      interestedFeatures: selectedFeatures,
      date: new Date().toISOString()
    });
    setShowFeedbackModal(false);
    // Reset pour la prochaine ouverture
    setTimeout(() => {
        setFeedbackStep('RATING');
        setUserRating(null);
        setSelectedFeatures([]);
    }, 500);
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => 
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  };

  const formatVal = (v: number) => {
    try {
      return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
    } catch (e) { return "0,00"; }
  };

  const fetchAiAdvice = async (force: boolean = false) => {
    // Récupération sécurisée de la clé API pour Vite/Vercel
    const API_KEY = import.meta.env?.VITE_GEMINI_API_KEY || "";
    
    if (!API_KEY) return;
    const cacheKey = `zentip_${activeAccount?.id}_${month}_${year}`;
    const cachedAdvice = sessionStorage.getItem(cacheKey);
    
    if (cachedAdvice && !force) { setAiAdvice(cachedAdvice); return; }
    if (loadingAdvice) return;
    
    setLoadingAdvice(true);
    try {
      const context = `Solde: ${availableBalance}€, Projeté: ${projectedBalance}€, État: ${projectedBalance < 0 ? 'Danger' : 'Zen'}. Compte: ${activeAccount.name}`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `Tu es un coach financier zen. Donne un conseil très court (max 60 car.) inspirant basé sur : ${context}. Pas de guillemets.` }] }] })
      });
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleanedText = text.replace(/["']/g, "").trim();
        setAiAdvice(cleanedText);
        sessionStorage.setItem(cacheKey, cleanedText);
      }
    } catch (err) { console.error("Erreur Gemini:", err); } 
    finally { setLoadingAdvice(false); }
  };

  useEffect(() => {
    if (activeAccount?.id) fetchAiAdvice(); 
  }, [activeAccount?.id, month, year]);

  useEffect(() => {
    if (firstInstallDate && !hasGivenFeedback) {
      try {
        const daysSinceInstall = differenceInDays(new Date(), new Date(firstInstallDate));
        if (daysSinceInstall >= 7) {
          const timer = setTimeout(() => setShowFeedbackModal(true), 2000);
          return () => clearTimeout(timer);
        }
      } catch (e) { console.error(e); }
    }
  }, [firstInstallDate, hasGivenFeedback]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const stats = useMemo(() => {
    let income = 0, expenses = 0;
    (transactions || []).forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expenses += t.amount;
    });
    return { income, expenses };
  }, [transactions]);

  const categorySummary = useMemo(() => {
    const map: Record<string, { value: number; notes: string[] }> = {};
    (transactions || []).filter(t => t.type === 'EXPENSE').forEach(t => {
      if (!map[t.categoryId]) map[t.categoryId] = { value: 0, notes: [] };
      map[t.categoryId].value += t.amount;
      if (t.comment && t.comment.trim() !== "") {
        map[t.categoryId].notes.push(t.comment.trim());
      }
    });
    const total = stats.expenses || 1;
    return Object.entries(map).map(([id, data]) => {
      const cat = categories.find(c => c.id === id);
      return { 
        id, name: cat?.name || 'Autres', value: data.value, color: cat?.color || '#94a3b8', 
        icon: cat?.icon || '📦', percent: (data.value / total) * 100,
        notes: Array.from(new Set(data.notes.reverse())).slice(0, 3)
      };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories, stats.expenses]);

  if (!activeAccount) return <div className="p-10 text-center text-slate-400">Chargement de votre espace zen...</div>;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      
      {/* MODALE PREMIUM */}
      <AnimatePresence>
        {premiumType && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[99999]" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setPremiumType(null)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-[340px] shadow-2xl text-center relative z-10"
              onClick={e => e.stopPropagation()}
            >
              <img src="/ZB-logo-192.png" alt="ZenBudget Logo" className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-lg border border-slate-100" />
              <h3 className="text-xl font-black text-slate-900 mb-2 italic">
                {premiumType === 'CSV' ? 'Export CSV' : 'Projets Zen'}
              </h3>
              <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
                {premiumType === 'CSV' 
                  ? "L'exportation vers Excel arrive bientôt dans ZenBudget Premium pour analyser vos finances en profondeur." 
                  : "Épargnez pour vos rêves ! La gestion de vos projets arrive bientôt pour vous aider à financer vos vacances ou vos envies."}
              </p>
              <button 
                onClick={() => { setPremiumType(null); setShowFeedbackModal(true); }} 
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
              >
                Donner mon avis ✨
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL FEEDBACK */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[99999]" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-indigo-950/30 backdrop-blur-md"
              onClick={() => setShowFeedbackModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[40px] p-6 w-full max-w-[340px] shadow-2xl relative z-10 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setShowFeedbackModal(false)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-500">
                <X className="w-5 h-5" />
              </button>

              <div className="text-center">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                  {feedbackStep === 'RATING' ? '✨' : '💎'}
                </div>

                {feedbackStep === 'RATING' ? (
                  <>
                    <h3 className="text-xl font-black text-slate-900 mb-1 italic">L'app vous plaît ?</h3>
                    <p className="text-xs text-slate-500 font-medium mb-6">Votre avis nous aide énormément.</p>
                    <div className="flex justify-center gap-2 mb-6">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setUserRating(star)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${userRating && userRating >= star ? 'bg-amber-400 text-white shadow-lg' : 'bg-slate-50 text-slate-300'}`}
                        >
                          <Star className={`w-4 h-4 ${userRating && userRating >= star ? 'fill-current' : ''}`} />
                        </button>
                      ))}
                    </div>
                    <button disabled={!userRating} onClick={() => setFeedbackStep('FEATURES')}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-30 shadow-xl"
                    >Suivant</button>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-black text-slate-900 mb-1 italic">ZenBudget Premium</h3>
                    <p className="text-[11px] text-slate-500 font-medium mb-4">Qu'est-ce qui vous serait le plus utile ?</p>
                    
                    <div className="grid grid-cols-2 gap-2 mb-6 text-left max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                      {[
                        { id: 'multi-accounts', label: 'Comptes Multiples', icon: '🏦' },
                        { id: 'share', label: 'Partage Zen', icon: '👥' },
                        { id: 'projects', label: 'Projets (Vacances...)', icon: '🎯' }, 
                        { id: 'csv', label: 'Export Excel', icon: '📊' }, 
                        { id: 'ai', label: 'Conseils IA', icon: '🤖' }
                      ].map((feat) => (
                        <button key={feat.id} onClick={() => toggleFeature(feat.id)}
                          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${selectedFeatures.includes(feat.id) ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-50 bg-slate-50/30'}`}
                        >
                          <span className="text-lg">{feat.icon}</span>
                          <span className={`text-[9px] font-black uppercase text-center leading-tight ${selectedFeatures.includes(feat.id) ? 'text-indigo-600' : 'text-slate-500'}`}>{feat.label}</span>
                        </button>
                      ))}
                    </div>
                    
                    <button onClick={handleSendFeedback} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                    >Envoyer <Send className="w-3 h-3" /></button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="pt-2 flex justify-between items-end">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={onPrevMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4 text-slate-400" /></button>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 capitalize">{format(currentDate, 'MMMM yyyy', { locale: fr })}</span>
            <button onClick={onNextMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none">Mon budget</h2>
            <div className="flex items-center gap-2 mt-3">
              <div className="relative" ref={menuRef}>
                <button onClick={() => allAccounts.length > 1 && setIsAccountMenuOpen(!isAccountMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm active:scale-95 transition-all">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{activeAccount?.name}</span>
                  {allAccounts.length > 1 && (
                    <svg className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${isAccountMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  )}
                </button>
                {isAccountMenuOpen && (
                  <div className="absolute left-0 mt-2 w-max min-w-[180px] bg-white border border-slate-100 rounded-2xl shadow-2xl z-[100] overflow-hidden fade-in py-1">
                    {allAccounts.map(acc => (
                      <button key={acc.id} onClick={() => { onSwitchAccount(acc.id); setIsAccountMenuOpen(false); }} className={`w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${acc.id === activeAccount?.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>{acc.name}</button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleFullAppRefresh} className={`p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-white transition-all active:scale-90 ${isRefreshing ? 'text-indigo-500' : ''}`}><RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /></button>
            </div>
          </div>
        </div>

        <button onClick={() => setPremiumType('CSV')} className="flex flex-col items-center gap-1 group">
          <div className="relative w-10 h-10 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-400 group-hover:text-indigo-600 flex items-center justify-center transition-all active:scale-90">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <div className="absolute -top-3 -right-2 text-lg drop-shadow-sm select-none">💎</div>
          </div>
          <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Export CSV</span>
        </button>
      </div>

      {/* SOLDES */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-slate-900 px-8 py-10 rounded-[40px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2 block">Solde en banque</span>
          <div className="flex items-baseline gap-2">
            <div className="text-5xl font-black tracking-tighter text-white">{formatVal(checkingAccountBalance)}</div>
            <span className="text-2xl font-bold text-indigo-400">€</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-6 rounded-[35px] shadow-xl flex flex-col justify-between min-h-[140px] ${availableBalance < 0 ? 'bg-rose-500' : 'bg-indigo-600'}`}>
            <span className="text-[10px] font-black uppercase text-white/60 block">Disponible Réel</span>
            <div className="text-2xl font-black text-white">{formatVal(availableBalance)}€</div>
          </div>
          <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[140px]">
            <span className="text-slate-400 text-[10px] font-black uppercase block">Report Précédent</span>
            <div className={`text-2xl font-black ${carryOver >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatVal(carryOver)}€</div>
          </div>
        </div>
      </div>

      {/* CONSEIL IA */}
      <div className="bg-indigo-50/50 backdrop-blur-sm p-6 rounded-[30px] flex items-center gap-5 border border-indigo-100/50 cursor-pointer hover:bg-indigo-50 transition-all active:scale-95" onClick={() => !loadingAdvice && fetchAiAdvice(true)}>
        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl shrink-0">
          {loadingAdvice ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : "💡"}
        </div>
        <div className="flex-1"><p className="text-[13px] font-bold text-slate-700 leading-snug italic">{aiAdvice}</p></div>
      </div>

      {/* SECTION PROJETS - RÉDUITE */}
      <div className="px-1">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-500" />
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Mes Projets</h2>
          </div>
          <button onClick={() => setPremiumType('PROJECTS')} className="relative w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg active:scale-90 transition-all">
            <Plus className="w-5 h-5" />
            <div className="absolute -top-3 -right-2 text-lg drop-shadow-sm select-none">💎</div>
          </button>
        </div>
        <div className="grid grid-cols-1">
          <button onClick={() => setPremiumType('PROJECTS')} className="group p-4 border border-dashed border-slate-200 rounded-[24px] bg-slate-50/50 hover:bg-indigo-50/30 transition-all flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shadow-sm">🎯</div>
            <div className="text-left">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Épargnez pour vos rêves <br/> <span className="text-[8px] font-bold text-slate-400">(Voyage Japon, Vacances été, etc.)</span></p>
              <span className="text-[9px] font-bold text-indigo-500/60 block mt-1">Bientôt disponible dans Premium</span>
            </div>
          </button>
        </div>
      </div>

      {/* REPARTITION DES CHARGES */}
      <div className="bg-white rounded-[45px] p-8 border border-slate-50 shadow-xl">
        <div className="flex flex-col items-center mb-10">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Répartition des charges</h2>
          <div className="h-[220px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categorySummary} innerRadius={75} outerRadius={95} paddingAngle={10} dataKey="value" stroke="none">
                  {categorySummary.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} cornerRadius={10} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] font-black uppercase text-slate-400">Dépenses</span>
              <span className="text-3xl font-black text-slate-900">{formatVal(stats.expenses)}€</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {categorySummary.map((cat) => (
            <div key={cat.id} className="group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>{cat.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-[11px] font-black uppercase text-slate-800 truncate">{cat.name}</span>
                    <span className="text-[13px] font-black text-slate-900">{formatVal(cat.value)}€</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                  </div>
                  {cat.notes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cat.notes.map((note, i) => (<span key={i} className="text-[9px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{note}</span>))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PROJECTION FIN DE MOIS */}
      <div className={`p-8 rounded-[40px] border-2 flex justify-between items-center ${projectedBalance < 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-50 shadow-sm'}`}>
        <div>
          <span className="text-slate-400 text-[10px] font-black uppercase block mb-1">
            Projection au {new Date(year, month + 1, 0).getDate()} {MONTHS_FR[month]}
          </span>
          <div className={`text-3xl font-black tracking-tighter ${projectedBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{formatVal(projectedBalance)} €</div>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${projectedBalance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
          {projectedBalance >= 0 ? "📈" : "⚠️"}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;