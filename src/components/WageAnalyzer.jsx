import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

const WageAnalyzer = () => {
  const [wageAccounts, setWageAccounts] = useState('');
  const [socialCostAccounts, setSocialCostAccounts] = useState('');
  const [standardRate, setStandardRate] = useState('31.42');
  const [retireeWages, setRetireeWages] = useState('');
  const [reducedRate, setReducedRate] = useState('10.21');
  const [materialityThreshold, setMaterialityThreshold] = useState('5000');
  const [adjustments, setAdjustments] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const confettiTriggeredRef = useRef(false);

  // Helper function to clean and parse Swedish/European formatted numbers
  const parseNumber = (str) => {
    if (!str || typeof str !== 'string') return 0;
    
    // Remove currency symbols (kr, SEK, etc.)
    let cleaned = str.replace(/[krSEK€$£¥]/gi, '').trim();
    
    // Remove spaces (thousands separators)
    cleaned = cleaned.replace(/\s/g, '');
    
    // Handle decimal separators (Swedish uses comma, but Excel might use dot)
    // If there's a comma, assume it's decimal separator
    // If there's a dot, check if it's followed by 1-2 digits (decimal) or 3+ digits (thousands)
    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, ''); // Remove dots (thousands)
      cleaned = cleaned.replace(',', '.'); // Replace comma with dot for parsing
    } else if (cleaned.includes('.')) {
      // Check if dot is decimal or thousands separator
      const parts = cleaned.split('.');
      if (parts.length > 1 && parts[parts.length - 1].length <= 2) {
        // Last part is 1-2 digits, so dot is decimal separator
        cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
      } else {
        // Dot is thousands separator
        cleaned = cleaned.replace(/\./g, '');
      }
    }
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Parse tab-separated Excel data
  const parseExcelData = (data) => {
    const lines = data.trim().split('\n');
    const accounts = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const accountName = parts[0].trim();
        const currentYear = parseNumber(parts[1]);
        const previousYear = parts.length >= 3 ? parseNumber(parts[2]) : 0;
        
        accounts.push({
          name: accountName,
          currentYear,
          previousYear
        });
      }
    }
    
    return accounts;
  };

  const handleAnalyze = () => {
    // Parse wage accounts
    const wageData = parseExcelData(wageAccounts);
    const socialCostData = parseExcelData(socialCostAccounts);
    
    // Step A: Sum up totals
    const totalWagesCY = wageData.reduce((sum, acc) => sum + acc.currentYear, 0);
    
    const totalSocialCY = socialCostData.reduce((sum, acc) => sum + acc.currentYear, 0);
    
    // Step B: Get retiree wages from input
    const retireeWagesNum = parseNumber(retireeWages) || 0;
    
    // Step C: Validate - cap retiree wages at total wages if exceeded
    const validatedRetireeWages = Math.min(retireeWagesNum, totalWagesCY);
    
    // Step D: Calculate standard base
    const standardBase = totalWagesCY - validatedRetireeWages;
    
    // Step E: Calculate theoretical cost using split base method
    const standardRateNum = parseFloat(standardRate) || 31.42;
    const reducedRateNum = parseFloat(reducedRate) || 10.21;
    
    const retireeTheoreticalCost = validatedRetireeWages * (reducedRateNum / 100);
    const standardTheoreticalCost = standardBase * (standardRateNum / 100);
    const grossTheoreticalCost = retireeTheoreticalCost + standardTheoreticalCost;
    
    // Subtract adjustments
    const adjustmentsNum = parseNumber(adjustments) || 0;
    const netTheoreticalCost = grossTheoreticalCost - adjustmentsNum;
    
    // Calculate difference
    const difference = totalSocialCY - netTheoreticalCost;
    
    // Materiality test
    const materialityThresholdNum = parseFloat(materialityThreshold) || 5000;
    const absoluteDifference = Math.abs(difference);
    const isMaterial = absoluteDifference > materialityThresholdNum;
    
    const newResult = {
      totalWagesCY,
      totalSocialCY,
      retireeWages: validatedRetireeWages,
      standardBase,
      retireeTheoreticalCost,
      standardTheoreticalCost,
      grossTheoreticalCost,
      adjustments: adjustmentsNum,
      netTheoreticalCost,
      difference,
      materialityThreshold: materialityThresholdNum,
      isMaterial,
      standardRate: standardRateNum,
      reducedRate: reducedRateNum,
      hasRetireeWages: validatedRetireeWages > 0,
      validationWarning: retireeWagesNum > totalWagesCY
    };
    
    setAnalysisResult(newResult);
    // Reset confetti trigger flag when new analysis is run
    confettiTriggeredRef.current = false;
  };

  // Trigger confetti when audit result is PASS
  useEffect(() => {
    if (analysisResult && !analysisResult.isMaterial && !confettiTriggeredRef.current) {
      // Subtle confetti effect for PASS result
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10b981', '#059669', '#34d399'], // Green shades
        gravity: 0.8,
        ticks: 200
      });
      confettiTriggeredRef.current = true;
    }
  }, [analysisResult]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(value)) + ' kr';
  };

  const formatPercent = (value) => {
    return value.toFixed(2) + '%';
  };

  const copyToClipboard = async () => {
    if (!analysisResult) return;

    // Format numbers as raw numbers for Excel (no currency symbols, locale-aware formatting)
    const formatNumber = (value) => {
      // Use locale formatting but without currency symbol for Excel compatibility
      return new Intl.NumberFormat('sv-SE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        useGrouping: true
      }).format(Math.round(value));
    };

    const auditConclusion = analysisResult.isMaterial ? 'FAIL' : 'PASS';

    // Create tab-separated string for Excel in the exact order specified
    const excelData = [
      ['Item', 'Amount'],
      ['Standard Wages Base', formatNumber(analysisResult.standardBase)],
      ['Reduced Wages Base', formatNumber(analysisResult.retireeWages)],
      ['Theoretical Social Costs', formatNumber(analysisResult.netTheoreticalCost)],
      ['Actual Booked Costs', formatNumber(analysisResult.totalSocialCY)],
      ['Difference', formatNumber(analysisResult.difference)],
      ['Materiality Limit', formatNumber(analysisResult.materialityThreshold)],
      ['Audit Conclusion', auditConclusion]
    ].map(row => row.join('\t')).join('\n');

    try {
      await navigator.clipboard.writeText(excelData);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      alert('Failed to copy to clipboard. Please allow clipboard access if prompted.');
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Audit Reasonableness Tool - Social Security Contributions</h2>
        <p className="text-sm text-gray-600 mb-6">
          Analyze wage accounts and social cost accounts to verify reasonableness of social security contributions
        </p>
        
        {/* Input Section */}
        <div className="space-y-6">
          {/* Wage Accounts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste Wage Accounts (Excel)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Format: Account Name | Current Year | Previous Year (Tab-separated)
            </p>
            <textarea
              value={wageAccounts}
              onChange={(e) => setWageAccounts(e.target.value)}
              placeholder="Account Name | Current Year | Previous Year"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
              rows={6}
            />
          </div>

          {/* Social Cost Accounts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste Social Cost Accounts (Excel)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Format: Account Name | Current Year | Previous Year (Tab-separated)
            </p>
            <textarea
              value={socialCostAccounts}
              onChange={(e) => setSocialCostAccounts(e.target.value)}
              placeholder="Account Name | Current Year | Previous Year"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
              rows={6}
            />
          </div>

          <div className="space-y-4">
            {/* Input 1: Standard Tax Rate */}
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Standard Tax Rate (%)
              </label>
              <input
                type="number"
                value={standardRate}
                onChange={(e) => setStandardRate(e.target.value)}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="31.42"
              />
            </div>

            {/* Input 2: Wages with Reduced Social Costs */}
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wages with Reduced Social Costs (kr)
              </label>
              <input
                type="text"
                value={retireeWages}
                onChange={(e) => setRetireeWages(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Löner med nedsatta avgifter (underlag)
              </p>
            </div>

            {/* Inputs 3-5: Reduced Rate, Deductions, Materiality */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
              {/* Input 3: Reduced Tax Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reduced Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={reducedRate}
                  onChange={(e) => setReducedRate(e.target.value)}
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="10.21"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Current rate for retirees
                </p>
              </div>

              {/* Input 4: Other Deductions/Adjustments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Other Deductions/Adjustments (kr)
                </label>
                <input
                  type="text"
                  value={adjustments}
                  onChange={(e) => setAdjustments(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Fixed deductions (e.g., Regional Support amounts)"
                />
              </div>

              {/* Input 5: Materiality Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materiality Threshold (kr)
                </label>
                <input
                  type="number"
                  value={materialityThreshold}
                  onChange={(e) => setMaterialityThreshold(e.target.value)}
                  step="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="5000"
                />
              </div>
            </div>
          </div>

          {/* Run Audit Test Button */}
          <button
            onClick={handleAnalyze}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-sm"
          >
            Run Audit Test
          </button>
        </div>
      </div>

      {/* Results Section */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Audit Conclusion Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-300">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Audit Conclusion</h3>
            
            {/* Status Header */}
            <div className={`rounded-lg p-6 mb-6 ${
              analysisResult.isMaterial
                ? 'bg-red-50 border-2 border-red-300'
                : 'bg-green-50 border-2 border-green-300'
            }`}>
              <div className="text-center">
                <div className="text-4xl mb-2">
                  {analysisResult.isMaterial ? '⚠️' : '✅'}
                </div>
                <div className={`text-2xl font-bold ${
                  analysisResult.isMaterial ? 'text-red-800' : 'text-green-800'
                }`}>
                  {analysisResult.isMaterial 
                    ? 'FAIL: Material Difference Detected'
                    : 'PASS: Difference is Immaterial'}
                </div>
                <p className={`text-sm mt-2 ${
                  analysisResult.isMaterial ? 'text-red-700' : 'text-green-700'
                }`}>
                  {analysisResult.isMaterial
                    ? 'The variance exceeds your threshold. Investigate booking errors or missing adjustments.'
                    : 'The variance is within your defined threshold.'}
                </p>
              </div>
            </div>

            {/* Math Breakdown */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Calculation Breakdown</h4>
              
              {/* Validation Warning */}
              {analysisResult.validationWarning && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Warning: Retiree wages exceeded total wages. Capped at total wages amount.
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-300">
                  <span className="text-gray-700">
                    Standard Wages (@ {analysisResult.standardRate}%):
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(analysisResult.standardTheoreticalCost)}
                  </span>
                </div>
                
                {analysisResult.hasRetireeWages && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-300">
                    <span className="text-gray-700">
                      Reduced Wages (@ {analysisResult.reducedRate}%):
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(analysisResult.retireeTheoreticalCost)}
                    </span>
                  </div>
                )}
                
                {analysisResult.adjustments > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-300">
                    <span className="text-gray-700">
                      Less: Fixed Deductions:
                    </span>
                    <span className="font-semibold text-red-600">
                      - {formatCurrency(analysisResult.adjustments)}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center py-3 pt-3 border-t-2 border-gray-400 mt-2">
                  <span className="text-lg font-semibold text-gray-800">
                    = Theoretical Total:
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(analysisResult.netTheoreticalCost)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-300">
                  <span className="text-gray-700">
                    Actual Booked:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(analysisResult.totalSocialCY)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-3 pt-3 border-t-2 border-gray-400 mt-2">
                  <span className="text-lg font-semibold text-gray-800">
                    Difference:
                  </span>
                  <span className={`text-lg font-bold ${
                    analysisResult.isMaterial ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {analysisResult.difference >= 0 ? '+' : ''}{formatCurrency(analysisResult.difference)}
                    {!analysisResult.isMaterial && (
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        (Immaterial)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Copy to Clipboard Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={copyToClipboard}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-sm"
                >
                  Copy Result to Clipboard (Excel)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300">
          <div className="flex items-center gap-2">
            <span className="text-xl">✓</span>
            <span>Copied to clipboard!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WageAnalyzer;

