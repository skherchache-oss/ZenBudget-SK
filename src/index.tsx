import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Assure-toi que ton fichier CSS est bien là

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}