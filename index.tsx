
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const startApp = () => {
  const container = document.getElementById('root');
  if (!container) return;

  try {
    const root = createRoot(container);
    root.render(<App />);
  } catch (err) {
    container.innerHTML = `<div style="padding:40px;text-align:center;font-family:sans-serif;">
      <h2 style="color:#ef4444;">Erreur Fatale</h2>
      <p style="color:#64748b;">${err instanceof Error ? err.message : 'Inconnue'}</p>
      <button onclick="localStorage.clear();location.reload();" style="background:#10b981;color:white;padding:12px 24px;border:none;border-radius:12px;font-weight:bold;margin-top:20px;">Réparer maintenant</button>
    </div>`;
  }
};

// On attend que le DOM soit prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
