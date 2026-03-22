
console.log("CLIENT: index.tsx loading...");
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("CLIENT: Locating root element...");
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("CLIENT: FATAL - Could not find root element");
  throw new Error("Could not find root element to mount to");
}

console.log("CLIENT: Mounting React app...");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
console.log("CLIENT: index.tsx execution complete.");
