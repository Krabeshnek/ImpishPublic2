import React, { useState } from 'react';

const TransactionAggregator = () => {
  const [rawData, setRawData] = useState('');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [separateDebitCredit, setSeparateDebitCredit] = useState(true);
  const [groupByColumn, setGroupByColumn] = useState('1');
  const [dateColumn, setDateColumn] = useState('2');
  const [descriptionColumn, setDescriptionColumn] = useState('3');
  const [debitColumn, setDebitColumn] = useState('5');
  const [creditColumn, setCreditColumn] = useState('6');
  const [amountColumn, setAmountColumn] = useState('4');
  const [consolidatedData, setConsolidatedData] = useState(null);
  const [showToast, setShowToast] = useState(false);

  // Helper function to clean and parse Swedish/European formatted numbers
  const parseNumber = (str) => {
    if (!str || typeof str !== 'string') return 0;
    
    // Remove currency symbols (kr, SEK, etc.)
    let cleaned = str.replace(/[krSEK€$£¥]/gi, '').trim();
    
    // Remove spaces (thousands separators)
    cleaned = cleaned.replace(/\s/g, '');
    
    // Handle decimal separators (Swedish uses comma, but Excel might use dot)
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

  // Format number with 2 decimal places
  const formatNumber = (num) => {
    return num.toFixed(2);
  };

  // Format number as Swedish currency
  const formatCurrency = (num) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Parse tab-separated Excel data
  const parseExcelData = (data) => {
    const lines = data.trim().split('\n');
    return lines.map(line => {
      const columns = line.split('\t');
      return columns.map(col => col.trim());
    });
  };

  // Consolidate rows
  const handleConsolidate = () => {
    if (!rawData.trim()) {
      alert('Please paste some data first.');
      return;
    }

    const groupCol = parseInt(groupByColumn) - 1;
    const dateCol = parseInt(dateColumn) - 1;
    const descCol = parseInt(descriptionColumn) - 1;

    // Validate column numbers
    if (isNaN(groupCol) || groupCol < 0) {
      alert('Invalid Group ID Column number.');
      return;
    }

    if (isNaN(dateCol) || dateCol < 0) {
      alert('Invalid Date Column number.');
      return;
    }

    if (isNaN(descCol) || descCol < 0) {
      alert('Invalid Description Column number.');
      return;
    }

    if (separateDebitCredit) {
      const debitCol = parseInt(debitColumn) - 1;
      const creditCol = parseInt(creditColumn) - 1;
      
      if (isNaN(debitCol) || debitCol < 0) {
        alert('Invalid Debit Column number.');
        return;
      }
      if (isNaN(creditCol) || creditCol < 0) {
        alert('Invalid Credit Column number.');
        return;
      }
    } else {
      const amountCol = parseInt(amountColumn) - 1;
      if (isNaN(amountCol) || amountCol < 0) {
        alert('Invalid Amount Column number.');
        return;
      }
    }

    try {
      const rows = parseExcelData(rawData);
      const aggregationMap = new Map();

      let headers = null;
      let dataRows = rows;
      let rawRowCount = 0;

      // Extract headers if checkbox is checked
      if (hasHeaders && rows.length > 0) {
        headers = rows[0];
        dataRows = rows.slice(1); // Skip first row
      }

      // Process data rows
      dataRows.forEach((row, index) => {
        if (row.length === 0 || row.every(cell => !cell.trim())) return; // Skip empty rows

        rawRowCount++;

        const key = row[groupCol] || `Row_${index + 1}`;
        const date = row[dateCol] || '';
        const description = row[descCol] || '';

        let debitTotal = 0;
        let creditTotal = 0;

        if (separateDebitCredit) {
          // Separate Debit/Credit mode
          const debitCol = parseInt(debitColumn) - 1;
          const creditCol = parseInt(creditColumn) - 1;
          const debitStr = row[debitCol] || '0';
          const creditStr = row[creditCol] || '0';
          debitTotal = parseNumber(debitStr);
          creditTotal = parseNumber(creditStr);
        } else {
          // Single Amount Column mode
          const amountCol = parseInt(amountColumn) - 1;
          const amountStr = row[amountCol] || '0';
          const amount = parseNumber(amountStr);
          // If amount is positive, treat as debit; if negative, treat as credit
          if (amount >= 0) {
            debitTotal = amount;
            creditTotal = 0;
          } else {
            debitTotal = 0;
            creditTotal = Math.abs(amount);
          }
        }

        const netAmount = debitTotal - creditTotal;

        if (aggregationMap.has(key)) {
          const existing = aggregationMap.get(key);
          existing.debitTotal += debitTotal;
          existing.creditTotal += creditTotal;
          existing.netAmount = existing.debitTotal - existing.creditTotal;
          existing.count += 1;
        } else {
          aggregationMap.set(key, {
            verId: key,
            date: date,
            description: description,
            debitTotal: debitTotal,
            creditTotal: creditTotal,
            netAmount: netAmount,
            count: 1,
          });
        }
      });

      const consolidated = Array.from(aggregationMap.values()).sort((a, b) => {
        // Sort by Ver ID (verification number) if it's numeric, otherwise alphabetically
        const aNum = parseFloat(a.verId);
        const bNum = parseFloat(b.verId);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.verId.localeCompare(b.verId);
      });

      setConsolidatedData({
        consolidated: consolidated,
        rawCount: rawRowCount,
        uniqueCount: consolidated.length,
        separateDebitCredit: separateDebitCredit,
      });
    } catch (error) {
      alert(`Error processing data: ${error.message}`);
    }
  };

  // Copy to clipboard for Excel/Audit Sampler
  const handleCopyToClipboard = () => {
    if (!consolidatedData) return;

    const lines = [];
    
    // Add headers
    lines.push('Ver ID\tDate\tDescription\tTotal Debit\tTotal Credit\tNet Amount');

    // Add data rows
    consolidatedData.consolidated.forEach(item => {
      lines.push(
        `${item.verId}\t${item.date}\t${item.description}\t${formatNumber(item.debitTotal)}\t${formatNumber(item.creditTotal)}\t${formatNumber(item.netAmount)}`
      );
    });

    const text = lines.join('\n');

    // Create HTML version for better Excel pasting
    let htmlTable = '<table border="1">';
    
    // Add header row
    htmlTable += '<tr>';
    htmlTable += '<th>Ver ID</th>';
    htmlTable += '<th>Date</th>';
    htmlTable += '<th>Description</th>';
    htmlTable += '<th>Total Debit</th>';
    htmlTable += '<th>Total Credit</th>';
    htmlTable += '<th>Net Amount</th>';
    htmlTable += '</tr>';

    // Add data rows
    consolidatedData.consolidated.forEach(item => {
      htmlTable += '<tr>';
      htmlTable += `<td>${item.verId}</td>`;
      htmlTable += `<td>${item.date}</td>`;
      htmlTable += `<td>${item.description}</td>`;
      htmlTable += `<td>${formatNumber(item.debitTotal)}</td>`;
      htmlTable += `<td>${formatNumber(item.creditTotal)}</td>`;
      htmlTable += `<td>${formatNumber(item.netAmount)}</td>`;
      htmlTable += '</tr>';
    });
    
    htmlTable += '</table>';

    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([htmlTable], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    });

    navigator.clipboard.write([clipboardItem]).then(() => {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }).catch(() => {
      // Fallback to plain text
      navigator.clipboard.writeText(text).then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      });
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Transaction Aggregator
          </h1>
          <p className="text-lg text-gray-600">
            Merge multiple journal lines into single verification events.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Input Data
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste Raw Excel Data
            </label>
            <textarea
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              placeholder="Ver# | Date | Description | Account | Debit | Credit"
              className="w-full h-48 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            <p className="mt-2 text-xs text-gray-500">
              Paste tab-separated data from Excel
            </p>
          </div>

          {/* Top Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={hasHeaders}
                  onChange={(e) => setHasHeaders(e.target.checked)}
                  className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  First row contains headers
                </span>
              </label>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={separateDebitCredit}
                  onChange={(e) => setSeparateDebitCredit(e.target.checked)}
                  className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Separate Debit/Credit Columns
                </span>
              </label>
            </div>
          </div>

          {/* Column Mapping Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group ID (Ver#) Column
              </label>
              <input
                type="number"
                value={groupByColumn}
                onChange={(e) => setGroupByColumn(e.target.value)}
                min="1"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Column
              </label>
              <input
                type="number"
                value={dateColumn}
                onChange={(e) => setDateColumn(e.target.value)}
                min="1"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description Column
              </label>
              <input
                type="number"
                value={descriptionColumn}
                onChange={(e) => setDescriptionColumn(e.target.value)}
                min="1"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="3"
              />
            </div>

            {separateDebitCredit ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Debit Column
                  </label>
                  <input
                    type="number"
                    value={debitColumn}
                    onChange={(e) => setDebitColumn(e.target.value)}
                    min="1"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Credit Column
                  </label>
                  <input
                    type="number"
                    value={creditColumn}
                    onChange={(e) => setCreditColumn(e.target.value)}
                    min="1"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="6"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount Column
                </label>
                <input
                  type="number"
                  value={amountColumn}
                  onChange={(e) => setAmountColumn(e.target.value)}
                  min="1"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="4"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleConsolidate}
            className="w-full md:w-auto px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-md"
          >
            Consolidate & Analyze
          </button>
        </div>

        {/* Output Section */}
        {consolidatedData && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Consolidated Results
              </h2>
              <button
                onClick={handleCopyToClipboard}
                className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                {showToast ? 'Copied!' : 'Copy Table to Clipboard'}
              </button>
            </div>

            {/* Summary */}
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Consolidated {consolidatedData.rawCount} rows</span> into{' '}
                <span className="font-semibold">{consolidatedData.uniqueCount} unique verifications</span>.
              </p>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                      Ver ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                      Total Debit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                      Total Credit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                      Net Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consolidatedData.consolidated.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">
                        {item.verId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border border-gray-300">
                        {item.date}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300">
                        {item.description || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900 border border-gray-300">
                        {formatNumber(item.debitTotal)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900 border border-gray-300">
                        {formatNumber(item.creditTotal)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold border border-gray-300 ${
                        item.netAmount === 0 
                          ? 'text-green-600' 
                          : item.netAmount > 0 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      }`}>
                        {formatNumber(item.netAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-sm font-bold text-gray-900 border border-gray-300">
                      Total
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 border border-gray-300">
                      {formatNumber(
                        consolidatedData.consolidated.reduce((sum, item) => sum + item.debitTotal, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 border border-gray-300">
                      {formatNumber(
                        consolidatedData.consolidated.reduce((sum, item) => sum + item.creditTotal, 0)
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-bold border border-gray-300 ${
                      consolidatedData.consolidated.reduce((sum, item) => sum + item.netAmount, 0) === 0
                        ? 'text-green-600'
                        : 'text-gray-900'
                    }`}>
                      {formatNumber(
                        consolidatedData.consolidated.reduce((sum, item) => sum + item.netAmount, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
            Copied to clipboard!
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionAggregator;
