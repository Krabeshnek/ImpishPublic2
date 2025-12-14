import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  return (
    <header className="text-white shadow-lg" style={{ backgroundColor: '#842832' }}>
      <div className="flex items-center justify-between py-6 px-6">
        <div className="flex items-center">
          <img src="/logo.png" alt="Impish" className="h-24 border-0 bg-transparent ml-6" />
          <div className="ml-4">
            <h1 className="text-3xl font-bold">Version 0.1</h1>
            <p className="text-red-200 text-sm mt-2">Daniel's audit toolbox</p>
          </div>
        </div>
        <nav className="flex gap-4 mr-6">
          <Link
            to="/"
            className={`px-4 py-2 rounded-lg transition-colors ${
              location.pathname === '/'
                ? 'bg-red-800 text-white'
                : 'text-red-200 hover:bg-red-800 hover:text-white'
            }`}
          >
            Audit Sampler
          </Link>
          <Link
            to="/k10"
            className={`px-4 py-2 rounded-lg transition-colors ${
              location.pathname === '/k10'
                ? 'bg-red-800 text-white'
                : 'text-red-200 hover:bg-red-800 hover:text-white'
            }`}
          >
            3:12 K10 Calculator
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;

