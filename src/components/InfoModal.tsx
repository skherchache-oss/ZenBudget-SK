import React from 'react';

interface Props {
  onClose: () => void;
}

const InfoModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Box */}
      <div className="relative bg-white rounded-[35px] p-6 w-[90%] max-w-[380px] shadow-2xl">
        <h2 className="text-lg font-black text-slate-900 mb-3">
          Bienvenue 👋
        </h2>

        <p className="text-sm text-slate-600 leading-relaxed">
          ZenBudget vous aide à suivre vos finances simplement :<br /><br />
          • Ajoutez vos dépenses et revenus<br />
          • Suivez votre solde en temps réel<br />
          • Visualisez vos catégories automatiquement<br />
          • Gardez le contrôle sans effort ✨
        </p>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-indigo-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest"
        >
          Compris
        </button>
      </div>
    </div>
  );
};

export default InfoModal;