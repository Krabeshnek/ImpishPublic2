import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const tools = [
    {
      title: 'Audit Sampler',
      description: 'Generate random samples for materiality testing.',
      link: '/audit-sampler',
      icon: '🔀'
    },
    {
      title: '3:12 Calculator (WIP)',
      description: 'Calculate K10 dividend space (Gränsbelopp).',
      link: '/k10',
      icon: '💰'
    },
    {
      title: 'Social Cost Validator',
      description: 'Analyze wage accounts vs. booked social fees.',
      link: '/wage-analyzer',
      icon: '👥'
    },
    {
      title: 'Transaction Aggregator',
      description: 'Merge multiple journal lines into single verification events.',
      link: '/transaction-aggregator',
      icon: '🔗'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tool Grid Section */}
      <div className="bg-white">
        <div className="container mx-auto px-6 py-12">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Audit Toolkit
            </h1>
            <p className="text-gray-600">
              Automated utilities for financial review.
            </p>
          </div>

          {/* Tool Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tools.map((tool, index) => (
              <Link
                key={index}
                to={tool.link}
                className="bg-white rounded-lg shadow-md border border-gray-200 p-6 h-full flex flex-col hover:-translate-y-1 hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl">{tool.icon}</span>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    {tool.title}
                  </h2>
                </div>
                <p className="text-gray-600 leading-relaxed flex-grow">
                  {tool.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="container mx-auto px-6 py-6">
          <p className="text-center text-sm text-gray-500">
            Internal Use Only
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;

