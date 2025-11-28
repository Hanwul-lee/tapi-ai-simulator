// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import AccessGate from './AccessGate.jsx';   // ✅ App 대신 AccessGate 사용
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AccessGate />
  </React.StrictMode>,
);
