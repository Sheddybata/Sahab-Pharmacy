
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeOfflineSync } from './lib/offline-sync';
import { autoFixCostPriceData } from './lib/fix-cost-price-data';

// Initialize offline sync
initializeOfflineSync();

// Auto-fix cost price data issue (one-time fix on app startup)
// This fixes batches where cost_price is stored as total pack cost instead of per-unit cost
// NOTE: Only fixes batches with clearly wrong values (> 500K) to avoid over-correction
const enableAutoCostPriceFix = import.meta.env.VITE_ENABLE_AUTO_COST_PRICE_FIX === 'true';
if (enableAutoCostPriceFix) {
  autoFixCostPriceData().catch(() => {
    // Silently fail - don't block app startup if fix fails
  });
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful:', registration.scope);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

// Remove dark mode class addition
createRoot(document.getElementById("root")!).render(<App />);
