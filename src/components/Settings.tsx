import React, { useState, useRef, useEffect } from 'react'; 
import { AppState, BudgetAccount, Category } from '../types'; 
import { IconPlus } from './Icons'; 
import { createDefaultAccount, generateId } from '../store'; 
import { User as FirebaseUser, updateProfile, deleteUser } from 'firebase/auth';
import { Info, ShieldCheck, FileText, Scale, Star, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsProps { 
  state: AppState; 
  user: FirebaseUser | null;
  onUpdateAccounts: (accounts: BudgetAccount[]) => void; 
  onSetActiveAccount: (id: string) => void; 
  onDeleteAccount: (id: string) => void; 
  onReset: () => void; 
  onUpdateCategories: (cats: Category[]) => void; 
  onUpdateBudget: (val: number) => void; 
  onLogin: () => void; 
  onLogout: () => void; 
  onShowWelcome: () => void; 
  onBackup: (accountName?: string) => void;
  onImport: (file: File) => void;
  onUpdateUser: (userData: { name?: string; photoURL?: string | null }) => void; 
  onGiveFeedback?: (data: any) => void;
} 

const EMOJI_LIST = [
  '💰', '🛒', '🚗', '🏠', '🍕', '🎮', '🏥', '🔌', '🎁', '✈️', 
  '👕', '🎓', '🛡️', '🍿', '🏋️', '📱', '🐕', '🌿', '🛠️', '💼',
  '👶', '🍼', '🧸', '🍭', '🚲', '🎨', '📚', '💄', '💇', '🕯️'
];

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#475569'];

const AccountItem: React.FC<{ 
  acc: BudgetAccount; 
  isActive: boolean; 
  onDelete: (id: string) => void; 
  onRename: (acc: BudgetAccount) => void; 
  onSelect: (id: string) => void; 
  onShowPremium: () => void;
  canDelete: boolean; 
}> = ({ acc, isActive, onDelete, onRename, onSelect, onShowPremium, canDelete }) => { 
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false); 

  const handleDelete = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    if (!isConfirmingDelete) { 
      setIsConfirmingDelete(true); 
      setTimeout(() => setIsConfirmingDelete(false), 3000); 
      return; 
    } 
    onDelete(acc.id); 
  }; 

  return ( 
    <div 
      className={`flex items-center justify-between bg-white rounded-2xl p-3.5 mb-2 border transition-all cursor-pointer ${isActive ? 'border-indigo-200 shadow-sm ring-2 ring-indigo-50' : 'border-slate-100 hover:border-slate-200'}`} 
      onClick={() => onSelect(acc.id)} 
    > 
      <div className="flex items-center gap-3 min-w-0"> 
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${acc.color}15` }}> 
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} /> 
        </div> 
        <div className="flex flex-col min-w-0"> 
          <span className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{acc.name}</span> 
          {isActive && <span className="text-[7px] font-black text-indigo-500 uppercase tracking-[0.1em]">Compte actif</span>} 
        </div> 
      </div> 

      <div className="flex items-center gap-1"> 
        <button onClick={(e) => { e.stopPropagation(); onShowPremium(); }} className="p-2 text-slate-300 hover:text-indigo-500 flex items-center gap-1 transition-colors"> 
          <span className="text-[10px]">💎</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        </button> 
        <button onClick={(e) => { e.stopPropagation(); onRename(acc); }} className="p-2 text-slate-300 hover:text-indigo-600"> 
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> 
        </button> 
        {canDelete && ( 
          <button 
            onClick={handleDelete} 
            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${isConfirmingDelete ? 'bg-red-500 text-white' : 'text-red-200 hover:text-red-400'}`} 
          > 
            {isConfirmingDelete ? 'Sûr ?' : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} 
          </button> 
        )} 
      </div> 
    </div> 
  ); 
}; 

const Settings: React.FC<SettingsProps> = ({ state, user, onUpdateAccounts, onSetActiveAccount, onDeleteAccount, onReset, onShowWelcome, onBackup, onImport, onLogin, onLogout, onUpdateUser, onUpdateCategories, onGiveFeedback }) => { 
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackStep, setFeedbackStep] = useState<'RATING' | 'FEATURES'>('RATING');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null); 
  const [editName, setEditName] = useState(''); 
  const [manualDay, setManualDay] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [tempUserName, setTempUserName] = useState(user?.displayName || '');
  
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: '👶', color: '#6366f1' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showFeedbackModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showFeedbackModal]);

  const handleSendFeedback = () => {
    onGiveFeedback?.({
      rating: userRating,
      interestedFeatures: selectedFeatures,
      date: new Date().toISOString(),
      source: 'settings_premium'
    });
    setShowFeedbackModal(false);
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

  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId); 
  const currentCycleDay = activeAccount?.cycleEndDay || 0;
  const presets = [25, 26, 27, 28, 0];
  const isCustomDay = !presets.includes(currentCycleDay);

  const SectionTitle: React.FC<{ title: string }> = ({ title }) => ( 
    <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-3">{title}</h2> 
  ); 

  const handleSaveRename = () => { 
    if (!editingAccountId || !editName.trim()) { 
      setEditingAccountId(null); 
      return; 
    } 
    const nextAccounts = state.accounts.map(a => a.id === editingAccountId ? { ...a, name: editName.trim() } : a); 
    onUpdateAccounts(nextAccounts); 
    setEditingAccountId(null); 
  }; 

  const handleSaveUserName = async () => {
    if (!user || !tempUserName.trim()) {
      setIsEditingUserName(false);
      return;
    }
    try {
      await updateProfile(user, { displayName: tempUserName.trim() });
      onUpdateUser({ name: tempUserName.trim() });
      setIsEditingUserName(false);
    } catch (err) {
      console.error("Erreur mise à jour nom:", err);
      setIsEditingUserName(false);
    }
  };

  const handleAddCategory = () => {
    if (!newCat.name.trim()) return;
    const cat: Category = {
      id: `cat-user-${generateId()}`,
      name: newCat.name.trim(),
      icon: newCat.icon,
      color: newCat.color
    };
    onUpdateCategories([...state.categories, cat]);
    setNewCat({ name: '', icon: '👶', color: '#6366f1' });
    setShowAddCat(false);
  };

  const handleDeleteCategory = (id: string) => {
    if (state.categories.length <= 1) {
        alert("Vous devez garder au moins une catégorie.");
        return;
    }
    if (confirm("Supprimer cette catégorie ? Les transactions liées n'auront plus d'icône spécifique.")) {
        onUpdateCategories(state.categories.filter(c => c.id !== id));
    }
  };

  const handleDeleteUserAccount = async () => {
    if (!user) return;
    const confirmDelete = prompt("Pour supprimer définitivement votre compte ZenBudget et TOUTES vos données Cloud, tapez sans espaces 'SUPPRIMER'");
    if (confirmDelete === 'SUPPRIMER') {
      try {
        await deleteUser(user);
        alert("Votre compte a été supprimé. A bientôt ! ✨");
        onLogout();
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login') {
          alert("Action sensible : Veuillez vous reconnecter, puis réessayer immédiatement la suppression.");
          onLogout();
        } else {
          alert("Une erreur est survenue lors de la suppression.");
        }
      }
    }
  };

  const updateCycleDay = (day: number) => { 
    if (!activeAccount) return; 
    const nextAccounts = state.accounts.map(a => a.id === activeAccount.id ? { ...a, cycleEndDay: day } : a); 
    onUpdateAccounts(nextAccounts); 
  }; 

  const handleManualDayUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const day = parseInt(manualDay);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      updateCycleDay(day === 31 ? 0 : day);
      setManualDay('');
    }
  };

  const compressHighQuality = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const SIZE = 512;
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const ratio = Math.max(SIZE / img.width, SIZE / img.height);
            const x = (SIZE - img.width * ratio) / 2;
            const y = (SIZE - img.height * ratio) / 2;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, SIZE, SIZE);
            ctx.drawImage(img, x, y, img.width * ratio, img.height * ratio);
          }
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
      };
    });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      try {
        const highQualityUrl = await compressHighQuality(file);
        localStorage.setItem(`user_photo_hd_${user.uid}`, highQualityUrl);
        onUpdateUser({ photoURL: highQualityUrl });
        const canvas = document.createElement('canvas');
        canvas.width = 40; canvas.height = 40;
        const img = new Image();
        img.src = highQualityUrl;
        img.onload = async () => {
            canvas.getContext('2d')?.drawImage(img, 0, 0, 40, 40);
            const tiny = canvas.toDataURL('image/jpeg', 0.2);
            try { await updateProfile(user, { photoURL: tiny }); } catch (e) { }
        };
      } catch (err) { console.error("Erreur photo:", err);
      } finally {
        setIsUploading(false);
        if (photoInputRef.current) photoInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || isUploading) return;
    if (confirm("Supprimer la photo de profil ?")) {
      setIsUploading(true);
      try {
        localStorage.removeItem(`user_photo_hd_${user.uid}`);
        await updateProfile(user, { photoURL: null });
        onUpdateUser({ photoURL: null });
      } catch (err) { console.error("Erreur suppression photo:", err);
      } finally { setIsUploading(false); }
    }
  };

  const isRealUser = user && user.uid !== 'local-user';
  const currentPhoto = (user && localStorage.getItem(`user_photo_hd_${user.uid}`)) || state.user.photoURL;

  return ( 
    <div className="space-y-6 pb-32 overflow-y-auto no-scrollbar h-full px-4 pt-6"> 
      
      {/* MODAL FEEDBACK PREMIUM */}
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
                        { id: 'projects', label: 'Multi-projets', icon: '🎯' }, 
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

      {/* PROFIL SECTION */}
      <section className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative group">
            <div 
              onClick={() => photoInputRef.current?.click()}
              className={`w-20 h-20 rounded-[28px] bg-slate-50 border-4 border-white flex items-center justify-center overflow-hidden shadow-xl transition-all group-hover:ring-4 group-hover:ring-indigo-50 cursor-pointer ${isUploading ? 'opacity-50' : ''}`}
            >
              {currentPhoto ? (
                <img src={currentPhoto} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-indigo-600 uppercase">
                  {user?.displayName?.charAt(0) || 'Z'}
                </span>
              )}
              <div className="absolute inset-0 bg-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <svg className="w-6 h-6 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
              </div>
              {isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
            </div>
            {currentPhoto && !isUploading && (
              <button onClick={handleRemovePhoto} className="absolute -top-1 -right-1 w-6 h-6 bg-white text-slate-300 hover:text-red-500 hover:scale-110 border border-slate-100 rounded-full shadow-sm flex items-center justify-center transition-all z-10">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            <input type="file" ref={photoInputRef} hidden accept="image/*" onChange={handlePhotoChange} />
          </div>

          <div className="flex flex-col items-center w-full min-w-0">
            {isEditingUserName ? (
              <div className="flex items-center gap-2 w-full max-w-[200px]">
                <input autoFocus value={tempUserName} onChange={e => setTempUserName(e.target.value)} onBlur={handleSaveUserName} onKeyDown={e => e.key === 'Enter' && handleSaveUserName()} className="w-full bg-slate-50 border-2 border-indigo-100 rounded-xl px-3 py-1.5 text-center text-sm font-black text-slate-800 outline-none" />
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1 max-w-full cursor-pointer group" onClick={() => isRealUser && setIsEditingUserName(true)}>
                <h3 className="font-black text-slate-800 text-lg leading-tight truncate group-hover:text-indigo-600 transition-colors">{user?.displayName || 'Utilisateur Invité'}</h3>
                {isRealUser && <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                <div className={`w-2 h-2 rounded-full shrink-0 ${isRealUser ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              </div>
            )}
            <p className="text-[11px] font-bold text-slate-400 truncate w-full px-4">{user?.email || 'Mode Hors-ligne'}</p>
          </div>
          <button onClick={() => isRealUser ? onLogout() : onLogin()} className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${!isRealUser ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100'}`}>{isRealUser ? 'Se déconnecter de ZenBudget' : 'Se connecter / S\'inscrire'}</button>
        </div>
      </section>

      {/* AIDE */}
      <section> 
        <SectionTitle title="Aide" /> 
        <div className="bg-white rounded-[24px] border border-slate-50 overflow-hidden shadow-sm"> 
          <button onClick={onShowWelcome} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"> 
            <div className="flex items-center gap-3"> 
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-sm group-active:scale-90 transition-transform">📖</div> 
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Guide Zen de l'application</span> 
            </div> 
            <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button> 
        </div> 
      </section>

      {/* COMPTES */}
      <section> 
        <SectionTitle title="Mes Comptes" /> 
        <div className="space-y-1"> 
          {state.accounts.map(acc => ( 
            <AccountItem 
              key={acc.id} 
              acc={acc} 
              isActive={state.activeAccountId === acc.id} 
              onDelete={onDeleteAccount} 
              onRename={(a) => { setEditingAccountId(a.id); setEditName(a.name); }} 
              onSelect={onSetActiveAccount} 
              onShowPremium={() => setShowFeedbackModal(true)}
              canDelete={state.accounts.length > 1} 
            /> 
          ))} 
           
          {editingAccountId && ( 
            <div className="bg-white p-3 rounded-2xl border-2 border-indigo-100 mb-2"> 
              <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-50 p-2.5 rounded-xl mb-2 text-xs font-bold outline-none" /> 
              <div className="flex gap-2"> 
                <button onClick={() => setEditingAccountId(null)} className="flex-1 py-2 text-[9px] font-black uppercase text-slate-400">Annuler</button> 
                <button onClick={handleSaveRename} className="flex-1 py-2 text-[9px] font-black uppercase text-white bg-indigo-600 rounded-xl">Renommer</button> 
              </div> 
            </div> 
          )} 

          <button onClick={() => setShowFeedbackModal(true)} className="w-full py-3.5 border-2 border-dashed border-slate-100 text-slate-300 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl hover:border-indigo-200 hover:text-indigo-500 transition-all group"> 
            <span className="opacity-40 group-hover:opacity-100">💎</span>
            <IconPlus className="w-3 h-3" /> Ajouter un compte 
          </button> 
        </div> 
      </section>

      {/* GESTION CATÉGORIES AMÉLIORÉE */}
      <section>
        <SectionTitle title="Mes Catégories" />
        <div className="bg-white rounded-[32px] border border-slate-100 p-5 shadow-sm space-y-5">
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 no-scrollbar">
            {state.categories.map(cat => (
              <div key={cat.id} className="group flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0" style={{ backgroundColor: `${cat.color}15` }}>
                    {cat.icon}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-tight text-slate-600 truncate">{cat.name}</span>
                </div>
                <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>

          {showAddCat ? (
            <div className="p-4 bg-indigo-50/50 rounded-[24px] border border-indigo-100 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="space-y-2">
                <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest ml-1">1. Choisir une icône</span>
                <div className="grid grid-cols-5 gap-1.5 p-2 bg-white rounded-2xl border border-indigo-100 max-h-40 overflow-y-auto no-scrollbar">
                  {EMOJI_LIST.map(e => (
                    <button key={e} onClick={() => setNewCat({...newCat, icon: e})} className={`w-8 h-8 flex items-center justify-center rounded-xl text-lg transition-all ${newCat.icon === e ? 'bg-indigo-600 shadow-md scale-110' : 'hover:bg-slate-50'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest ml-1">2. Nom & Couleur</span>
                <div className="flex gap-2">
                  <input autoFocus value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})} className="flex-1 bg-white border border-indigo-100 rounded-xl px-4 py-2 text-xs font-bold outline-none placeholder:text-slate-300" placeholder="Ex: Bébé, École..." />
                  <div className="flex gap-1 p-1 bg-white rounded-xl border border-indigo-100 flex-wrap max-w-[100px] justify-center">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => setNewCat({...newCat, color: c})} className={`w-4 h-4 rounded-full transition-transform ${newCat.color === c ? 'ring-2 ring-offset-1 ring-indigo-400 scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleAddCategory} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">Enregistrer</button>
                <button onClick={() => setShowAddCat(false)} className="px-5 py-3 text-slate-400 text-[9px] font-black uppercase hover:text-slate-600">Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddCat(true)} className="w-full py-4 border-2 border-dashed border-indigo-100 text-indigo-400 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl hover:bg-indigo-50 transition-all">
              <IconPlus className="w-3 h-3" /> Ajouter une catégorie
            </button>
          )}
        </div>
      </section>

      {/* CYCLE BUDGÉTAIRE */}
      <section>
        <SectionTitle title="Cycle Budgétaire" />
        <div className="bg-white p-4 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed px-1">Définissez le jour de clôture du mois (jour de paie).</p>
          <div className="grid grid-cols-5 gap-1.5">
            {presets.map((day) => (
              <button key={day} onClick={() => updateCycleDay(day)} className={`py-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${currentCycleDay === day ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                <span className="text-[11px] font-black">{day === 0 ? '31' : day}</span>
                <span className="text-[5px] font-black uppercase tracking-tighter">{day === 0 ? 'Fin de mois' : 'Du mois'}</span>
              </button>
            ))}
            {isCustomDay && <button disabled className="py-3 rounded-xl border-2 border-indigo-600 bg-indigo-600 text-white flex flex-col items-center justify-center gap-1 shadow-lg"><span className="text-[11px] font-black">{currentCycleDay}</span><span className="text-[5px] font-black uppercase tracking-tighter">Actif</span></button>}
          </div>
          <form onSubmit={handleManualDayUpdate} className="flex gap-2">
            <input type="number" min="1" max="31" value={manualDay} onChange={e => setManualDay(e.target.value)} placeholder={isCustomDay ? `Jour actuel: ${currentCycleDay}` : "Autre jour (1-31)"} className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none placeholder:text-slate-300" />
            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest">OK</button>
          </form>
        </div>
      </section>

      {/* SAUVEGARDE DES DONNÉES */}
      <section>
        <SectionTitle title="Sauvegarde des données" />
        <div className="bg-white rounded-[24px] border border-slate-50 overflow-hidden shadow-sm">
          <button onClick={() => onBackup(activeAccount?.name)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 border-b border-slate-50">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px]">💾</div><span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Export Backup</span></div>
          </button>
          <input type="file" ref={fileInputRef} hidden accept=".backup,.json" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white text-[10px]">📂</div><span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Import Backup</span></div>
          </button>
        </div>
      </section>

      {/* À PROPOS & LÉGAL */}
      <section>
        <SectionTitle title="À propos & Légal" />
        <div className="bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                  <Info size={14} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-700 leading-none mb-0.5">ZenBudget App</span>
                  <span className="text-[8px] font-bold text-slate-400">Version 1.0.0 Stable</span>
                </div>
             </div>
          </div>

          <div className="flex flex-col">
            <button 
              onClick={() => window.open('https://tonsite.com/confidentialite', '_blank')}
              className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50"
            >
               <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <ShieldCheck size={14} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Politique de Confidentialité</span>
               </div>
               <FileText size={12} className="text-slate-200" />
            </button>

            <button 
              onClick={() => window.open('https://tonsite.com/cgu', '_blank')}
              className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50"
            >
               <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <Scale size={14} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Conditions d'Utilisation</span>
               </div>
               <FileText size={12} className="text-slate-200" />
            </button>

            <button 
              onClick={() => window.open('https://tonsite.com/mentions-legales', '_blank')}
              className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
               <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Mentions Légales</span>
               </div>
               <FileText size={12} className="text-slate-200" />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER & DANGER ZONE */}
      <section className="pt-4 space-y-4"> 
        <div className="bg-slate-900 rounded-[32px] p-6 text-center relative overflow-hidden"> 
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/20 blur-3xl rounded-full" /> 
          <p className="text-[11px] font-medium text-indigo-100/80 mb-4 px-2 leading-relaxed">Un bug ou une idée ? Dites-le nous pour améliorer ZenBudget !</p> 
          <button onClick={() => window.location.href = `mailto:s.kherchache@gmail.com?subject=ZenBudget : Retour Bug/Idée`} className="w-full py-3.5 bg-white text-slate-900 font-black rounded-xl uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-xl">Signaler un bug ou proposer une idée ✨</button> 
        </div> 

        <div className="flex flex-col gap-2">
          <button onClick={onReset} className="w-full py-3 text-slate-400 font-black uppercase text-[8px] tracking-[0.2em] active:scale-95 transition-all hover:bg-slate-50 rounded-xl">Réinitialiser les données locales</button> 
          {isRealUser && <button onClick={handleDeleteUserAccount} className="w-full py-3 text-red-300 font-black uppercase text-[8px] tracking-[0.2em] active:scale-95 transition-all hover:bg-red-50 rounded-xl">Supprimer mon compte & données cloud</button>}
        </div>
      </section> 

      <div className="text-center pb-10"><p className="text-[7px] text-slate-200 font-black uppercase tracking-[0.5em]">ZenBudget — 2026 Edition</p></div> 
    </div> 
  ); 
}; 

export default Settings;