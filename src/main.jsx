// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // Import the main App component
import './index.css';       // Import CSS (includes Tailwind directives)
import '@fortawesome/fontawesome-free/css/all.min.css'; // Import Font Awesome CSS

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);