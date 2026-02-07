import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useSettingsStore } from './stores/settingsStore';

// Expose settings store to window for access from non-React code
(window as any).__settingsStore = useSettingsStore;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
