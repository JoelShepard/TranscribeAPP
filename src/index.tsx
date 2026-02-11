import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { HistoryProvider } from './context/HistoryContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HistoryProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </HistoryProvider>
  </React.StrictMode>
);
