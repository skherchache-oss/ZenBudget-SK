
import React, { useState } from 'react';
import { User } from '../types';
import { IconLogo } from './Icons';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulation d'auth - À connecter à Firebase/Supabase
    onLogin({
      id: Math.random().toString(36).substr(2, 9),
      email: email,
      name: email.split('@')[0],
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
      <div className="w-full max-w-sm space-y-10">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <IconLogo className="w-16 h-16" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter">ZenBudget</h1>
          <p className="text-gray-400 text-xs font-black uppercase tracking-[0.2em]">Votre sérénité financière commence ici</p>
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-indigo-100/50 border border-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-indigo-500" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">E-mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 transition font-bold"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-5 bg-gray-900 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest"
            >
              {isLogin ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>

          <div className="mt-8 space-y-6">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-gray-100 w-full" />
              <span className="bg-white px-4 text-[10px] font-black text-gray-300 uppercase tracking-widest absolute">Ou</span>
            </div>

            <button 
              onClick={() => onLogin({ id: 'google-123', email: 'user@gmail.com', name: 'User Google' })}
              className="w-full py-4 bg-white border border-gray-100 text-gray-700 font-bold rounded-2xl shadow-sm flex items-center justify-center gap-3 active:scale-95 transition-all text-xs"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Continuer avec Google
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
          {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"} 
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-indigo-600 underline"
          >
            {isLogin ? "S'inscrire" : "Se connecter"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
