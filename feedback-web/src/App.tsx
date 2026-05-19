import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FeedbackPage from './pages/FeedbackPage';

function NotFound(): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '24px',
        backgroundColor: '#F5F0E8',
      }}
    >
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '15px',
          color: '#5C3317',
          textAlign: 'center',
        }}
      >
        Page introuvable.
      </p>
    </div>
  );
}

export default function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/feedback/:token" element={<FeedbackPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
