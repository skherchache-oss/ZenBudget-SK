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

  // 👁️ AJOUT ICI
  const [showPassword, setShowPassword] = useState(false);

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
      setError("Erreur d'envoi.");
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-white lg:bg-slate-950 font-sans overflow-hidden">
      
      <div className="w-full max-w-[480px] h-full lg:h-auto lg:max-h-[95vh] bg-white lg:rounded-[50px] flex flex-col items-center justify-between p-8 sm:p-12 shadow-2xl">
        
        {/* HEADER */}
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

        {/* FORM */}
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

          {/* 👁️ PASSWORD AVEC TOGGLE */}
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-base font-bold text-slate-900 outline-none pr-12"
              required={isLogin}
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition"
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2"/>
                  <path
                    d="M10.5 5.5C12 5 13.5 5 15 5c6.5 0 10 7 10 7s-1.2 2.4-3.5 4.6"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </button>
          </div>

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

        {/* GOOGLE + LOCAL */}
        <div className="w-full space-y-4 shrink-0 mt-2">

          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors mx-auto block"
          >
            {isLogin ? "Créer un compte" : "Se connecter"}
          </button>

          <button 
            type="button"
            onClick={loginWithGoogle} 
            className="w-full py-5 bg-white border-2 border-slate-100 rounded-[20px] flex items-center justify-center gap-3 font-black text-xs uppercase text-slate-700 shadow-sm"
          >
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

        <p className="text-slate-300 text-[9px] font-bold uppercase tracking-[0.3em] py-2">
          ZenBudget — 2026
        </p>

      </div>
    </div>
  );
};

export default AuthScreen;