import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, loginWithGoogle } from '../firebase';

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

  // 👁️ état œil de Moscou
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
    } catch {
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
          <img
            src="/ZB-logo-192.png"
            alt="ZenBudget"
            className="w-16 h-16 rounded-[22px] shadow-lg border border-slate-200 mb-4"
          />

          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-1">
              {isLogin ? getGreeting() : "Bienvenue"}
            </p>
            <h1 className="text-3xl font-black italic text-slate-900">
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
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold"
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold"
            required
          />

          {/* PASSWORD + OEIL FIXÉ */}
          <div className="relative w-full">

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold pr-12"
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
            >
              {showPassword ? (
                // 👁️ OUVERT (propre)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              ) : (
                // 🙈 FERMÉ (corrigé — plus de coupe)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 3l18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M2 12s4-7 10-7c3.5 0 6.5 1.5 8.5 3.5M21 12s-3.5 7-10 7c-3.5 0-6.5-1.5-8.5-3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>

          </div>

          {error && <div className="text-rose-600 text-[10px] font-black text-center">{error}</div>}
          {success && <div className="text-emerald-600 text-[10px] font-black text-center">{success}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-indigo-600 text-white rounded-xl font-black"
          >
            {loading ? 'Traitement...' : isLogin ? 'Se connecter' : 'Créer un compte'}
          </button>

          {isLogin && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full text-[10px] font-black text-slate-400"
            >
              Mot de passe oublié ?
            </button>
          )}
        </form>

        {/* BOTTOM */}
        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-[11px] font-black text-slate-400 mx-auto block"
          >
            {isLogin ? "Créer un compte" : "Se connecter"}
          </button>

          <button
            type="button"
            onClick={loginWithGoogle}
            className="w-full py-5 bg-white border rounded-xl font-black"
          >
            Continuer avec Google
          </button>

          <button
            type="button"
            onClick={onLocalMode}
            className="w-full py-5 bg-slate-900 text-white rounded-xl font-black"
          >
            Mode Invité
          </button>
        </div>

      </div>
    </div>
  );
};

export default AuthScreen;