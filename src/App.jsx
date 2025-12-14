import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AuditSampler from './components/AuditSampler';
import ThreeTwelveCalculator from './components/ThreeTwelveCalculator';

function App() {
  return (
    <BrowserRouter>
      <div className="bg-gray-50 min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<AuditSampler />} />
          <Route path="/k10" element={<ThreeTwelveCalculator />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

