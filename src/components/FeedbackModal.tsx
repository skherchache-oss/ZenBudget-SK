import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedbackModalProps {
  onSubmit: (data: { rating: number; comment: string }) => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onSubmit }) => {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    
    onSubmit({ rating, comment });
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-[32px] w-full max-w-sm p-6 shadow-2xl relative"
        >
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-lg"
          >
            ✕
          </button>

          <div className="flex justify-center text-4xl mb-2">⭐</div>
          <h2 className="text-xl font-black text-center italic text-slate-800 tracking-tight mb-2">
            Votre avis compte !
          </h2>
          <p className="text-xs font-medium text-slate-500 text-center mb-6 leading-relaxed">
            Que pensez-vous de ZenBudget ? Aidez-nous à améliorer l'application.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-3xl transition-transform active:scale-125 ${
                    star <= rating ? 'opacity-100 scale-110' : 'opacity-30 grayscale'
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>

            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Un commentaire, un bug ou une idée ? (optionnel)"
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={rating === 0}
              className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all ${
                rating > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Envoyer mon retour
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FeedbackModal;