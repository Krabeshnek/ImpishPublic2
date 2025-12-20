import React, { useState } from 'react';

const ThreeTwelveCalculator = () => {
  // Constants for 2026 (SOU 2024:36)
  const IBB = 83400; // Inkomstbasbelopp (2026)
  const SLR = 0.0277; // Statslåneränta (2.77%)
  const CAPITAL_INTEREST_RATE = SLR + 0.09; // SLR + 9% premium = 11.77%
  
  // Optimization constants (2025/2026 estimates)
  const STATE_TAX_THRESHOLD = 643100; // The point where tax jumps to 50%
  const MAX_PENSION_SALARY = 650500; // The point where state pension contributions max out
  const EIGHT_IBB = 8 * IBB; // 667,200 kr - The floor for wage-based space
  const PBB = 57300; // Prisbasbelopp 2025 estimate
  const SGI_CEILING = 10 * PBB; // 573,000 kr - Cap for sick pay/parental leave
  
  // Company profit & cash flow constants
  const SOCIAL_COST_RATE = 0.3142; // 31.42% employer fees
  const CORP_TAX_RATE = 0.206; // 20.6% corporate tax

  // Helper function: Estimates Swedish Net Salary (2025 Rules)
  const calculateNetSalary = (grossSalary) => {
    if (!grossSalary) return 0;
    
    // 2025 Constants
    const PBB = 58800; // Prisbasbelopp
    const MUNICIPAL_TAX = 0.3241; // Average (32.41%)
    const STATE_TAX_LIMIT = 643100; // Brytpunkt
    
    // 1. Grundavdrag (Simplified approximation for owners > 400k)
    // For incomes > 7.87 PBB (462k), it flattens to ~0.293 PBB
    let deduction = 17300; 
    if (grossSalary < 462000) deduction = 30000; // Rough average for lower incomes

    const taxableIncome = Math.max(0, grossSalary - deduction);

    // 2. Base Tax (Municipal)
    let tax = taxableIncome * MUNICIPAL_TAX;

    // 3. State Tax (20% above threshold)
    if (grossSalary > STATE_TAX_LIMIT) {
      tax += (grossSalary - STATE_TAX_LIMIT) * 0.20;
    }

    // 4. Jobbskatteavdrag (Credit)
    // 2025 Estimate: Max credit is approx 37,000 kr/year
    // Simplified logic: High earners get the max credit (no tapering in 2025).
    let jobbskatteavdrag = 0;
    if (grossSalary > 40000) { 
       jobbskatteavdrag = Math.min(grossSalary, 37000); 
    } else {
       // Approx linear ramp up for very low salaries
       jobbskatteavdrag = grossSalary * 0.5; // (Very rough approx for low end)
    }

    // Final Tax Bill
    const finalTax = Math.max(0, tax - jobbskatteavdrag);
    
    return Math.round(grossSalary - finalTax);
  };

  // Helper function: Calculates the salary that makes Net Cash == Dividend Limit
  // NOW ACCOUNTING FOR OTHER EMPLOYEES
  // Returns 0 if profit is too low to reach equilibrium
  const calculateEquilibriumSalary = (profit, socialRate, corpTaxRate, ibb, otherEmployeesSalary = 0) => {
    if (!profit || profit < 0) return 0;

    const R = 1 - corpTaxRate;   // Retention rate (approx 0.794)
    const C = 1 + socialRate;    // Cost of salary (approx 1.3142)
    const cutoff = 8 * ibb;      // The "Dead Zone" threshold (~667k)
    const baseAmount = 4 * ibb;  // Grundbelopp (~333k)

    // We need to solve: NetCash(S) = DividendSpace(S + Others)
    
    // Formula A: High Salary (Total > 8 IBB)
    // Equation: (Profit - S*C)*R = Base + 0.5*((S + Others) - 8IBB)
    // Algebra simplifies to:
    // S = [ (Profit * R) - Base - 0.5*Others + 4*IBB ] / (0.5 + C * R)
    
    // Note: -Base + 4IBB cancels out to 0 (since Base = 4IBB).
    // Simplified Numerator: (Profit * R) - (0.5 * Others)
    const denomHigh = 0.5 + (C * R);
    const salaryHigh = ((profit * R) - (0.5 * otherEmployeesSalary)) / denomHigh;

    const totalProjected = salaryHigh + otherEmployeesSalary;

    if (totalProjected > cutoff) {
      return Math.max(0, Math.round(salaryHigh));
    }

    // Formula B: Low Salary (Total <= 8 IBB)
    // Here, Wage Space is 0. Space is just Base Amount.
    // Equation: (Profit - S*C)*R = Base
    // S = (Profit * R - Base) / (C * R)
    const salaryLow = ((profit * R) - baseAmount) / (C * R);

    return Math.max(0, Math.round(salaryLow));
  };

  // Input states
  const [ownershipShare, setOwnershipShare] = useState('');
  const [companyProfit, setCompanyProfit] = useState('');
  const [totalCompanySalaries, setTotalCompanySalaries] = useState('');
  const [ownerSalary, setOwnerSalary] = useState('');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [savedDividendSpace, setSavedDividendSpace] = useState('');

  // Result states
  const [grundbelopp, setGrundbelopp] = useState(null);
  const [lonebaserat, setLonebaserat] = useState(null);
  const [kapitaldel, setKapitaldel] = useState(null);
  const [savedSpace, setSavedSpace] = useState(null);
  const [totalGransbelopp, setTotalGransbelopp] = useState(null);
  const [taxAmount, setTaxAmount] = useState(null);
  const [copyButtonText, setCopyButtonText] = useState('📋 Copy to Excel');
  const [copyButtonClass, setCopyButtonClass] = useState('bg-red-600 hover:bg-red-700');
  const [strategy, setStrategy] = useState('CASH'); // 'CASH', 'SGI', or 'SPACE'
  const [isHoldingCompany, setIsHoldingCompany] = useState(false);

  const formatCurrency = (value) => {
    const formatted = new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
    return formatted + ' kr';
  };

  const handleCalculate = (overrideOwnerSalary, overrideTotalSalaries) => {
    // Parse inputs
    const ownership = parseFloat(ownershipShare) || 0;
    // Use override values if provided, otherwise fall back to state
    const totalSalaries = overrideTotalSalaries !== undefined 
      ? (typeof overrideTotalSalaries === 'number' ? overrideTotalSalaries : parseFloat(overrideTotalSalaries) || 0)
      : (parseFloat(totalCompanySalaries) || 0);
    const ownSalary = overrideOwnerSalary !== undefined
      ? (typeof overrideOwnerSalary === 'number' ? overrideOwnerSalary : parseFloat(overrideOwnerSalary) || 0)
      : (parseFloat(ownerSalary) || 0);
    const acquisition = parseFloat(acquisitionCost) || 0;
    const saved = parseFloat(savedDividendSpace) || 0;

    // Validation
    if (ownership <= 0 || ownership > 100) {
      alert('Ownership Share must be between 0 and 100%.');
      return;
    }

    // Component A: Grundbelopp (Base Amount)
    // Formula: (4 * IBB) * (ownershipShare / 100)
    const componentA = (4 * IBB) * (ownership / 100);

    // Component B: Lönebaserat utrymme (Wage-based Space)
    // Step 1: Calculate User's Share of Salaries
    const userShareSalaries = totalSalaries * (ownership / 100);
    // Step 2: Deduct the "Entry Fee" (8 IBB) and apply 50% multiplier
    const wageSpaceBeforeCap = Math.max(0, userShareSalaries - (8 * IBB)) * 0.50;
    // Step 3: Apply cap (cannot exceed 50 * ownerSalary)
    const cap = 50 * ownSalary;
    const componentB = Math.min(wageSpaceBeforeCap, cap);

    // Component C: Kapitalunderlag (Capital Space)
    // Interest is calculated on acquisition cost exceeding 100,000 kr
    const capitalBase = Math.max(0, acquisition - 100000);
    const componentC = capitalBase * CAPITAL_INTEREST_RATE;

    // Total Gränsbelopp: A + B + C + SavedSpace
    const total = componentA + componentB + componentC + saved;
    const tax = total * 0.20; // 20% tax

    // Set results
    setGrundbelopp(componentA);
    setLonebaserat(componentB);
    setKapitaldel(componentC);
    setSavedSpace(saved);
    setTotalGransbelopp(total);
    setTaxAmount(tax);
  };

  const copyToExcel = async () => {
    if (totalGransbelopp === null) {
      alert('Please calculate results first.');
      return;
    }

    try {
      const inputs = [
        ['Input', 'Value'],
        ['Ownership Share (%)', ownershipShare + '%'],
        ['Total Company Salaries', formatCurrency(parseFloat(totalCompanySalaries) || 0)],
        ["Owner's Salary", formatCurrency(parseFloat(ownerSalary) || 0)],
        ['Share Acquisition Cost', formatCurrency(parseFloat(acquisitionCost) || 0)],
        ['Saved Dividend Space', formatCurrency(parseFloat(savedDividendSpace) || 0)],
        ['', ''],
        ['Component', 'Amount'],
        ['Grundbelopp (Base Amount)', formatCurrency(grundbelopp)],
        ['Lönebaserat utrymme (Wage-based)', formatCurrency(lonebaserat)],
        ['Kapitalunderlag (Capital Space)', formatCurrency(kapitaldel)],
        ['Sparat utdelningsutrymme (Saved)', formatCurrency(savedSpace)],
        ['', ''],
        ['Total Gränsbelopp', formatCurrency(totalGransbelopp)],
        ['20% Tax Amount', formatCurrency(taxAmount)]
      ];

      let htmlContent = '<h3>3:12 Calculator (WIP) Results</h3><table border="1" style="border-collapse: collapse;">';
      inputs.forEach((row, idx) => {
        htmlContent += '<tr>';
        row.forEach(cell => {
          if (idx === 0 || idx === 7) {
            htmlContent += `<th style="background-color: #f3f4f6; padding: 5px;">${cell}</th>`;
          } else {
            htmlContent += `<td style="padding: 5px;">${cell}</td>`;
          }
        });
        htmlContent += '</tr>';
      });
      htmlContent += '</table>';

      let plainText = '3:12 Calculator (WIP) Results\n';
      inputs.forEach(row => {
        plainText += row.join('\t') + '\n';
      });

      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' })
      });

      await navigator.clipboard.write([clipboardItem]);

      setCopyButtonText('✓ Copied!');
      setCopyButtonClass('bg-green-600 hover:bg-green-700');
      
      setTimeout(() => {
        setCopyButtonText('📋 Copy to Excel');
        setCopyButtonClass('bg-red-600 hover:bg-red-700');
      }, 2000);

    } catch (err) {
      alert('Failed to copy to clipboard. Please allow clipboard access if prompted.');
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">3:12 Calculator (WIP) (2026 Rules)</h2>
        <p className="text-sm text-gray-600 mb-6">Based on SOU 2024:36 - New rules effective Jan 1, 2026</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ownership Share (%)
            </label>
            <input
              type="number"
              value={ownershipShare}
              onChange={(e) => setOwnershipShare(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="e.g., 50"
              min="0"
              max="100"
              step="0.01"
            />
            <p className="text-xs text-gray-500 mt-1">Critical for the new rules</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Company Profit (before Salary)
            </label>
            <input
              type="number"
              value={companyProfit}
              onChange={(e) => setCompanyProfit(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="e.g. 1500000"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Company Salaries
            </label>
            <input
              type="number"
              value={totalCompanySalaries}
              onChange={(e) => setTotalCompanySalaries(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Total kontanta bruttolöner i bolaget"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner's Salary
            </label>
            <input
              type="number"
              value={ownerSalary}
              onChange={(e) => setOwnerSalary(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Egen lön"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share Acquisition Cost
            </label>
            <input
              type="number"
              value={acquisitionCost}
              onChange={(e) => setAcquisitionCost(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Omkostnadsbelopp"
              min="0"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Saved Dividend Space
            </label>
            <input
              type="number"
              value={savedDividendSpace}
              onChange={(e) => setSavedDividendSpace(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Sparat utdelningsutrymme"
              min="0"
            />
          </div>
        </div>

        {/* Net Salary Estimator */}
        {ownerSalary && parseFloat(ownerSalary) > 0 && (
          <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200 mb-6">
            <h4 className="text-lg font-semibold text-blue-800 mb-3">Net Salary Estimator</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Gross Salary:</div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(parseFloat(ownerSalary) || 0)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Estimated Net Salary (2025):</div>
                <div className="text-xl font-bold text-blue-900">
                  {formatCurrency(calculateNetSalary(parseFloat(ownerSalary) || 0))}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const gross = parseFloat(ownerSalary) || 0;
                    const net = calculateNetSalary(gross);
                    const effectiveRate = gross > 0 ? ((1 - (net / gross)) * 100).toFixed(1) : '0.0';
                    return `Approx. ${effectiveRate}% effective tax rate`;
                  })()}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3 italic">
              * This is an estimate based on 2025 Swedish tax rules. Actual net salary may vary based on municipality, deductions, and other factors.
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={handleCalculate}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-sm"
          >
            Beräkna Gränsbelopp
          </button>
          {totalGransbelopp !== null && (
            <button
              onClick={copyToExcel}
              className={`${copyButtonClass} text-white font-semibold px-4 py-3 rounded-lg transition-colors shadow-sm text-sm`}
            >
              {copyButtonText}
            </button>
          )}
        </div>
      </div>

      {totalGransbelopp !== null && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Total Gränsbelopp</h3>
            <div className="bg-red-100 rounded-lg p-6 border border-red-300">
              <div className="text-4xl font-bold text-red-900 mb-4 text-center">
                {formatCurrency(totalGransbelopp)}
              </div>
              <div className="border-t border-red-300 pt-4 mt-4">
                <div className="text-sm text-gray-700 mb-2 text-center">20% Tax:</div>
                <div className="text-2xl font-bold text-red-900 text-center">
                  {formatCurrency(taxAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* Component Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Component Breakdown</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">Grundbelopp:</span>
                <span className="font-semibold text-gray-900">+ {formatCurrency(grundbelopp)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">Lönebaserat:</span>
                <span className="font-semibold text-gray-900">+ {formatCurrency(lonebaserat)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">Kapitaldel:</span>
                <span className="font-semibold text-gray-900">+ {formatCurrency(kapitaldel)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">Sparat:</span>
                <span className="font-semibold text-gray-900">+ {formatCurrency(savedSpace)}</span>
              </div>
              <div className="flex justify-between items-center py-3 pt-3 border-t-2 border-red-300 mt-2">
                <span className="text-lg font-semibold text-gray-800">Total:</span>
                <span className="text-lg font-bold text-red-900">{formatCurrency(totalGransbelopp)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optimization Recommendation with Smart Strategy Selector */}
      {totalCompanySalaries && parseFloat(totalCompanySalaries) > 0 && (
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-300">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Smart Strategy Selector</h4>
            
            {/* Strategy Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Strategy</label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setStrategy('CASH')}
                  className={`px-2 py-2 rounded-lg font-semibold text-xs transition-colors ${
                    strategy === 'CASH'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Minimize Tax
                </button>
                <button
                  onClick={() => setStrategy('SGI')}
                  className={`px-2 py-2 rounded-lg font-semibold text-xs transition-colors ${
                    strategy === 'SGI'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Secure SGI
                </button>
                <button
                  onClick={() => setStrategy('SPACE')}
                  className={`px-2 py-2 rounded-lg font-semibold text-xs transition-colors ${
                    strategy === 'SPACE'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Smart Balance
                </button>
                <button
                  onClick={() => setStrategy('EQUILIBRIUM')}
                  className={`px-2 py-2 rounded-lg font-semibold text-xs transition-colors ${
                    strategy === 'EQUILIBRIUM'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Max Payout
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {strategy === 'CASH' 
                  ? 'Maximize Cash / 0 Salary'
                  : strategy === 'SGI'
                  ? 'Maximize Insurance / 573k'
                  : strategy === 'SPACE'
                  ? 'Maximize K10 Space / 643k'
                  : 'Drain Company / Calculated'}
              </p>
            </div>

            {/* Holding Company Toggle */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHoldingCompany}
                  onChange={(e) => setIsHoldingCompany(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  I own this via a Holding Company (0% Dividend Tax)
                </span>
              </label>
            </div>

            {(() => {
              const totalSalaries = parseFloat(totalCompanySalaries) || 0;
              const currentSalary = parseFloat(ownerSalary) || 0;
              const profit = parseFloat(companyProfit) || 0;
              const inDeadZone = totalSalaries < EIGHT_IBB;
              const showDeadZoneWarning = inDeadZone && (strategy === 'SGI' || strategy === 'SPACE');
              
              // Calculate surplus and equilibrium
              let netAvailableCash = 0;
              let surplus = 0;
              let drainSalary = 0;
              
              if (profit > 0 && totalGransbelopp !== null) {
                // Calculate net available cash (using current salary for display purposes)
                const costOfSalary = currentSalary * (1 + SOCIAL_COST_RATE);
                const profitAfterSalary = profit - costOfSalary;
                const corporateTax = Math.max(0, profitAfterSalary) * CORP_TAX_RATE;
                netAvailableCash = Math.max(0, profitAfterSalary - corporateTax);
                surplus = netAvailableCash - totalGransbelopp;
                
                // Calculate other employees' salary (total - owner)
                const otherEmployeesSalary = Math.max(0, totalSalaries - currentSalary);
                
                // Calculate equilibrium salary (accounting for other employees)
                drainSalary = calculateEquilibriumSalary(profit, SOCIAL_COST_RATE, CORP_TAX_RATE, IBB, otherEmployeesSalary);
              }
              
              // Helper function to apply recommendation
              const handleApply = (recommendedSalary) => {
                const safeRecommended = Number(recommendedSalary) || 0;
                const currentOwner = Number(ownerSalary) || 0;
                const currentTotal = Number(totalCompanySalaries) || 0;

                // 1. Calculate how much we are changing the owner's salary
                const difference = safeRecommended - currentOwner;

                // 2. Update Owner Salary
                setOwnerSalary(safeRecommended.toString());

                // 3. Smart Update Total Salaries
                // Take the old total and add the difference.
                // Safety Check: Ensure the Total never drops below the Owner's salary.
                const newTotal = Math.max(safeRecommended, currentTotal + difference);
                
                setTotalCompanySalaries(newTotal.toString());

                // 4. Auto-calculate after state updates
                // Pass the new salary numbers directly to avoid race condition with stale state
                // This ensures the calculator uses the exact numbers we just calculated
                setTimeout(() => {
                  handleCalculate(safeRecommended, newTotal);
                }, 100);
              };
              
              // Logic A: Dead Zone Check (for SGI and SPACE strategies)
              if (showDeadZoneWarning) {
                return (
                  <div>
                    <div className="bg-red-50 rounded-lg p-4 border-2 border-red-300 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">⚠️</span>
                        <h5 className="text-lg font-semibold text-red-900">
                          Dividend Trap Warning
                        </h5>
                      </div>
                      <p className="text-sm text-red-900 leading-relaxed">
                        Your total company salaries are below <strong>{formatCurrency(EIGHT_IBB)}</strong> (8 IBB). Under the new rules, you get <strong>0 kr</strong> wage-based space until total salaries cross this floor. Increasing your own salary right now will NOT give you any extra K10 space.
                      </p>
                    </div>
                    
                    {/* Still show recommendation even in Dead Zone */}
                    {(() => {
                      let recommendation = null;
                      let recommendedSalary = 0;
                      
                      if (strategy === 'SGI') {
                        recommendedSalary = SGI_CEILING;
                        recommendation = {
                          message: 'Optimize for SGI',
                          optimalValue: formatCurrency(SGI_CEILING),
                          explanation: 'Optimizes for full insurance coverage (Sick Pay & Parental Leave) at the lowest cost. You stop before paying for \'extra\' pension points or chasing max dividend space.',
                          bgColor: 'bg-purple-50',
                          borderColor: 'border-purple-200',
                          textColor: 'text-purple-900',
                          titleColor: 'text-purple-800'
                        };
                      } else {
                        // Strategy = 'SPACE'
                        recommendedSalary = STATE_TAX_THRESHOLD;
                        recommendation = {
                          message: 'Optimize Salary',
                          optimalValue: formatCurrency(STATE_TAX_THRESHOLD),
                          explanation: 'Pushing salary to the State Tax Threshold maximizes your K10 space while keeping personal tax at ~32%.',
                          bgColor: 'bg-green-50',
                          borderColor: 'border-green-200',
                          textColor: 'text-green-900',
                          titleColor: 'text-green-800'
                        };
                      }
                      
                      return (
                        <div className={`${recommendation.bgColor} rounded-lg p-4 border-2 ${recommendation.borderColor}`}>
                          <h5 className={`text-lg font-semibold ${recommendation.titleColor} mb-2`}>
                            Recommendation: {recommendation.message}
                          </h5>
                          <p className={`${recommendation.textColor} text-sm mb-3`}>
                            Optimal Salary: <strong>{recommendation.optimalValue}</strong>
                          </p>
                          <p className={`${recommendation.textColor} text-sm leading-relaxed mb-3`}>
                            {recommendation.explanation}
                          </p>
                          {recommendedSalary > 0 && currentSalary !== recommendedSalary && (
                            <button
                              onClick={() => handleApply(recommendedSalary)}
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
                            >
                              Apply Recommendation
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              }
              
              // Logic B: Not in Dead Zone (or CASH/EQUILIBRIUM strategy)
              let recommendation = null;
              let recommendedSalary = 0;
              
              if (strategy === 'CASH') {
                recommendedSalary = 0;
                const hasTrappedCash = surplus > 0;
                recommendation = {
                  message: 'Stop Salary',
                  optimalValue: formatCurrency(0),
                  explanation: hasTrappedCash 
                    ? `⚠️ Trapped Cash: You have ${formatCurrency(surplus)} more cash than dividend space. Since you want cash now, Dividends (~37% effective tax) are cheaper than Salary (~47% effective tax).`
                    : 'Since you want cash now, Dividends (~37% effective tax) are cheaper than Salary (~47% effective tax).',
                  bgColor: 'bg-blue-50',
                  borderColor: 'border-blue-200',
                  textColor: 'text-blue-900',
                  titleColor: 'text-blue-800'
                };
              } else if (strategy === 'SGI') {
                recommendedSalary = SGI_CEILING;
                recommendation = {
                  message: 'Optimize for SGI',
                  optimalValue: formatCurrency(SGI_CEILING),
                  explanation: 'Optimizes for full insurance coverage (Sick Pay & Parental Leave) at the lowest cost. You stop before paying for \'extra\' pension points or chasing max dividend space.',
                  bgColor: 'bg-purple-50',
                  borderColor: 'border-purple-200',
                  textColor: 'text-purple-900',
                  titleColor: 'text-purple-800'
                };
              } else if (strategy === 'SPACE') {
                recommendedSalary = STATE_TAX_THRESHOLD;
                const isFullyUnlocked = surplus < 0;
                recommendation = {
                  message: 'Optimize Salary',
                  optimalValue: formatCurrency(STATE_TAX_THRESHOLD),
                  explanation: isFullyUnlocked
                    ? `✅ Fully Unlocked: Pushing salary to the State Tax Threshold maximizes your K10 space while keeping personal tax at ~32%.`
                    : 'Pushing salary to the State Tax Threshold maximizes your K10 space while keeping personal tax at ~32%.',
                  bgColor: 'bg-green-50',
                  borderColor: 'border-green-200',
                  textColor: 'text-green-900',
                  titleColor: 'text-green-800'
                };
              } else {
                // Strategy = 'EQUILIBRIUM'
                if (profit <= 0 || totalGransbelopp === null) {
                  recommendedSalary = 0;
                  recommendation = {
                    message: 'Drain Company',
                    optimalValue: 'N/A',
                    explanation: 'Please enter Company Profit and calculate Gränsbelopp first to calculate the equilibrium salary.',
                    bgColor: 'bg-gray-50',
                    borderColor: 'border-gray-200',
                    textColor: 'text-gray-700',
                    titleColor: 'text-gray-800'
                  };
                } else if (drainSalary <= 0) {
                  recommendedSalary = 0;
                  recommendation = {
                    message: 'Drain Company',
                    optimalValue: 'N/A',
                    explanation: 'Profit is too low to reach equilibrium. The company cannot generate enough cash to match the dividend limit.',
                    bgColor: 'bg-gray-50',
                    borderColor: 'border-gray-200',
                    textColor: 'text-gray-700',
                    titleColor: 'text-gray-800'
                  };
                } else {
                  recommendedSalary = drainSalary;
                  recommendation = {
                    message: 'Drain Company',
                    optimalValue: formatCurrency(drainSalary),
                    explanation: `Take ${formatCurrency(drainSalary)} salary. This aligns your Net Cash exactly with your Dividend Limit, leaving 0 kr trapped.`,
                    bgColor: 'bg-orange-50',
                    borderColor: 'border-orange-200',
                    textColor: 'text-orange-900',
                    titleColor: 'text-orange-800'
                  };
                }
              }
              
              return (
                <div className={`${recommendation.bgColor} rounded-lg p-4 border-2 ${recommendation.borderColor}`}>
                  <h5 className={`text-lg font-semibold ${recommendation.titleColor} mb-2`}>
                    Recommendation: {recommendation.message}
                  </h5>
                  <p className={`${recommendation.textColor} text-sm mb-3`}>
                    Optimal Salary: <strong>{recommendation.optimalValue}</strong>
                  </p>
                  <p className={`${recommendation.textColor} text-sm leading-relaxed mb-3`}>
                    {recommendation.explanation}
                  </p>
                  {recommendedSalary > 0 && currentSalary !== recommendedSalary && (
                    <button
                      onClick={() => handleApply(recommendedSalary)}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                      Apply Recommendation
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Cash Flow Reality Check */}
      {companyProfit && parseFloat(companyProfit) > 0 && ownerSalary && parseFloat(ownerSalary) > 0 && (
        <div className="mb-6">
          {(() => {
            const profit = parseFloat(companyProfit) || 0;
            const salary = parseFloat(ownerSalary) || 0;
            
            // Calculate cash flow
            const costOfSalary = salary * (1 + SOCIAL_COST_RATE);
            const profitAfterSalary = profit - costOfSalary;
            const corporateTax = Math.max(0, profitAfterSalary) * CORP_TAX_RATE;
            const netBeforeDividendTax = Math.max(0, profitAfterSalary - corporateTax);
            
            // Apply dividend tax based on holding company status
            // If holding company: 0% tax (multiply by 1.0)
            // If private owner: 20% tax (multiply by 0.8)
            const dividendTaxRate = isHoldingCompany ? 0 : 0.20;
            const netAvailableCash = netBeforeDividendTax * (1 - dividendTaxRate);
            
            // Compare with dividend limit
            const canPayFull = totalGransbelopp ? netAvailableCash >= totalGransbelopp : false;
            
            return (
              <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-300">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Cash Flow Reality Check</h4>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <div>
                      <span className="text-gray-700">Profit after Salary Cost:</span>
                      <p className="text-xs text-gray-500 mt-1">Profit - (Salary + 31.42% Fees)</p>
                    </div>
                    <span className="font-semibold text-gray-900">{formatCurrency(profitAfterSalary)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-700">Corporate Tax (20.6%):</span>
                    <span className="font-semibold text-red-600">- {formatCurrency(corporateTax)}</span>
                  </div>
                  
                  {isHoldingCompany && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Dividend Tax (0% - Holding Co):</span>
                      <span className="font-semibold text-green-600">0 kr</span>
                    </div>
                  )}
                  {!isHoldingCompany && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Dividend Tax (20%):</span>
                      <span className="font-semibold text-red-600">- {formatCurrency(netBeforeDividendTax * 0.20)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center py-3 pt-3 border-t-2 border-gray-300 mt-2">
                    <span className="text-lg font-semibold text-gray-800">
                      {isHoldingCompany ? 'Tax-Free Dividend to Holding Co:' : 'Net Cash Available for Dividend:'}
                    </span>
                    <span className="text-lg font-bold text-green-600">{formatCurrency(netAvailableCash)}</span>
                  </div>
                </div>
                
                {/* Can I Pay? Status */}
                {totalGransbelopp && (
                  <div className={`mt-4 p-4 rounded-lg border-2 ${
                    canPayFull 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-orange-50 border-orange-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">
                        {canPayFull ? '✅' : '⚠️'}
                      </span>
                      <span className={`font-semibold ${
                        canPayFull ? 'text-green-800' : 'text-orange-800'
                      }`}>
                        {canPayFull ? 'Fully Funded' : 'Partial Funding'}
                      </span>
                    </div>
                    <p className={`text-sm ${
                      canPayFull ? 'text-green-900' : 'text-orange-900'
                    }`}>
                      {canPayFull 
                        ? (isHoldingCompany 
                            ? 'You have enough cash to take the full tax-free dividend to your holding company!'
                            : 'You have enough cash to take the full low-tax dividend!')
                        : (
                          <>
                            You can only payout <strong>{formatCurrency(netAvailableCash)}</strong> of your limit. The rest is saved for next year.
                            {isHoldingCompany && (
                              <span className="block mt-1 text-xs italic">
                                Note: This money goes to your holding company, not your private account.
                              </span>
                            )}
                          </>
                        )
                      }
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Constants Info */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">2026 Constants</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">IBB:</span>
            <span className="ml-2 font-semibold">{formatCurrency(IBB)}</span>
          </div>
          <div>
            <span className="text-gray-600">SLR:</span>
            <span className="ml-2 font-semibold">{(SLR * 100).toFixed(2)}%</span>
          </div>
          <div>
            <span className="text-gray-600">Capital Rate:</span>
            <span className="ml-2 font-semibold">{(CAPITAL_INTEREST_RATE * 100).toFixed(2)}%</span>
          </div>
          <div>
            <span className="text-gray-600">Capital Base:</span>
            <span className="ml-2 font-semibold">Acquisition - 100,000 kr</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeTwelveCalculator;

