import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import AuditSampler from './components/AuditSampler';
import ThreeTwelveCalculator from './components/ThreeTwelveCalculator';
import WageAnalyzer from './components/WageAnalyzer';

function App() {
  return (
    <BrowserRouter>
      <div className="bg-gray-50 min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/audit-sampler" element={<AuditSampler />} />
          <Route path="/k10" element={<ThreeTwelveCalculator />} />
          <Route path="/wage-analyzer" element={<WageAnalyzer />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

