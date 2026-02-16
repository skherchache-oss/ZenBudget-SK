import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, loginWithGoogle } from '../firebase';
import { IconLogo } from './Icons';

interface AuthScreenProps {
  onLocalMode: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLocalMode }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour ✨";
    if (hour < 18) return "Bel après-midi 🌤️";
    return "Bonsoir 🌙";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(userCredential.user, { displayName: name.trim() });
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') setError('Utilisateur non trouvé.');
      else if (err.code === 'auth/wrong-password') setError('Mot de passe incorrect.');
      else if (err.code === 'auth/email-already-in-use') setError('Email déjà utilisé.');
      else setError('Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('Entrez votre email.'); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Mail envoyé !');
    } catch (err) {
      setError('Erreur d\'envoi.');
    } finally { setLoading(false); }
  };

  return (
    // Fond noir sur desktop (lg), blanc sur mobile
    <div className="h-screen w-full flex items-center justify-center bg-white lg:bg-slate-950 font-sans overflow-hidden">
      
      {/* Container Format Tablette sur Desktop, Full sur Mobile */}
      <div className="w-full max-w-[480px] h-full lg:h-auto lg:max-h-[95vh] bg-white lg:rounded-[50px] flex flex-col items-center justify-between p-8 sm:p-12 shadow-2xl">
        
        {/* Header / Logo - Mis à jour pour être identique à App.tsx */}
        <div className="w-full flex flex-col items-center shrink-0">
          <div className="relative mb-4">
            <img 
              src="/ZB-logo-192.png" 
              alt="ZenBudget" 
              className="w-16 h-16 rounded-[22px] shadow-lg border border-slate-200"
            />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 leading-none mb-1">
                {isLogin ? getGreeting() : "Bienvenue"}
            </p>
            <h1 className="text-3xl font-black tracking-tighter italic text-slate-900 leading-none">
              ZenBudget
            </h1>
          </div>
        </div>

        {/* Formulaire - Flex-grow pour occuper l'espace central */}
        <form onSubmit={handleSubmit} className="w-full space-y-3 my-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Nom de profil"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-base font-bold text-slate-900 outline-none"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-base font-bold text-slate-900 outline-none"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-base font-bold text-slate-900 outline-none"
            required={isLogin}
          />

          {error && <div className="text-rose-600 text-[10px] font-black uppercase text-center">{error}</div>}
          {success && <div className="text-emerald-600 text-[10px] font-black uppercase text-center">{success}</div>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-indigo-600 text-white rounded-[20px] font-black shadow-xl hover:bg-indigo-700 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {loading ? 'Traitement...' : isLogin ? 'Se connecter' : 'Créer mon compte'}
            </button>
            {isLogin && (
              <button type="button" onClick={handleForgotPassword} className="w-full text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2">
                Mot de passe oublié ?
              </button>
            )}
          </div>
        </form>

        {/* Sécurité - Un peu plus grande */}
        <div className="w-full py-4 bg-slate-50 rounded-3xl border border-slate-100 px-4 shrink-0">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">Sécurité Cloud</span>
          </div>
          <p className="text-[10px] text-slate-500 font-bold leading-tight text-center">
            Pas de connexion bancaire. Vos données sont cryptées sur Google Cloud. Confidentialité totale.
          </p>
        </div>

        {/* Boutons Alternatifs */}
        <div className="w-full space-y-4 shrink-0 mt-2">
          <div className="flex flex-col gap-3">
             <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors mx-auto"
            >
              {isLogin ? "Créer un compte" : "Se connecter"}
            </button>

            <button 
              type="button"
              onClick={loginWithGoogle} 
              className="w-full py-5 bg-white border-2 border-slate-100 rounded-[20px] flex items-center justify-center gap-3 font-black text-xs uppercase text-slate-700 shadow-sm"
            >
              <div className="w-5 h-5 shrink-0">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              Continuer avec Google
            </button>

            <button 
              type="button"
              onClick={onLocalMode} 
              className="w-full py-5 bg-slate-900 text-white rounded-[20px] text-xs font-black uppercase tracking-widest shadow-lg"
            >
              Mode Invité
            </button>
          </div>
        </div>

        <p className="text-slate-300 text-[9px] font-bold uppercase tracking-[0.3em] py-2">
          ZenBudget — 2026
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;