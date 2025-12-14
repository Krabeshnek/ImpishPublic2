import React, { useState, useRef } from 'react';

const AuditSampler = () => {
  // State for inputs
  const [dataInput, setDataInput] = useState('');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [idColumn, setIdColumn] = useState(1);
  const [amountColumn, setAmountColumn] = useState('');
  const [sampleSize, setSampleSize] = useState('');
  const [minValue, setMinValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [targetIds, setTargetIds] = useState('');

  // State for results
  const [currentResults, setCurrentResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [targetItems, setTargetItems] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [parsedHeaders, setParsedHeaders] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showTargetSection, setShowTargetSection] = useState(false);
  const [exclusionMessage, setExclusionMessage] = useState('');
  const [copyButtonText, setCopyButtonText] = useState('📋 Copy to Excel');
  const [copyButtonClass, setCopyButtonClass] = useState('bg-red-600 hover:bg-red-700');

  // Helper functions
  const cleanNumber = (str) => {
    if (typeof str !== 'string') {
      str = String(str);
    }
    
    let cleaned = str
      .replace(/[^\d.,\-\s]/g, '')
      .replace(/\s/g, '')
      .replace(/,/g, (match, offset, string) => {
        const afterComma = string.substring(offset + 1);
        if (/^\d{3}(\s|$)/.test(afterComma)) {
          return '';
        }
        return '.';
      });
    
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (value) => {
    const formatted = new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return formatted + ' kr';
  };

  const parseInput = () => {
    if (!dataInput.trim()) {
      alert('Please paste your data first.');
      return null;
    }

    const lines = dataInput.split(/\r?\n/).filter(line => line.trim() !== '');
    const rows = lines.map(line => line.split('\t').map(cell => cell.trim()));

    return {
      headers: hasHeaders ? rows[0] : null,
      data: hasHeaders ? rows.slice(1) : rows
    };
  };

  const validateAmountColumn = (parsed, columnIndex) => {
    if (!columnIndex || columnIndex < 1) {
      alert('Please enter a valid column index (1 or greater).');
      return false;
    }

    const colIdx = columnIndex - 1;
    const firstRow = parsed.data[0];
    
    if (!firstRow || colIdx >= firstRow.length) {
      alert(`Column index ${columnIndex} is out of range. Your data has ${firstRow ? firstRow.length : 0} columns.`);
      return false;
    }

    let validCount = 0;
    for (let i = 0; i < Math.min(10, parsed.data.length); i++) {
      const value = cleanNumber(parsed.data[i][colIdx]);
      if (value !== 0 || parsed.data[i][colIdx].trim() === '0') {
        validCount++;
      }
    }

    if (validCount === 0) {
      alert(`Column ${columnIndex} does not appear to contain valid numeric values. Please check your column index.`);
      return false;
    }

    return true;
  };

  const identifyTargets = (parsed, idColumnIndex, amountColumnIndex, targetValue, targetIds) => {
    const idColIdx = idColumnIndex - 1;
    const amountColIdx = amountColumnIndex - 1;
    
    const targetIdSet = new Set();
    if (targetIds && targetIds.trim()) {
      targetIds.split(',').forEach(id => {
        const trimmedId = id.trim();
        if (trimmedId) {
          targetIdSet.add(trimmedId);
        }
      });
    }
    
    const targetItems = [];
    const remainingItems = [];
    
    parsed.data.forEach(row => {
      const id = row[idColIdx] ? String(row[idColIdx]).trim() : '';
      const amount = Math.abs(cleanNumber(row[amountColIdx]));
      const isTargetByValue = targetValue && amount >= targetValue;
      const isTargetById = targetIdSet.has(id);
      
      if (isTargetByValue || isTargetById) {
        targetItems.push(row);
      } else {
        remainingItems.push(row);
      }
    });
    
    return {
      targets: {
        headers: parsed.headers,
        data: targetItems
      },
      remaining: {
        headers: parsed.headers,
        data: remainingItems
      },
      targetCount: targetItems.length
    };
  };

  const filterByMinimumValue = (parsed, columnIndex, minValue) => {
    if (!minValue || minValue <= 0) {
      return {
        filtered: parsed,
        excludedCount: 0,
        originalCount: parsed.data.length,
        minValue: 0,
        originalParsed: parsed,
        excludedData: {
          headers: parsed.headers,
          data: []
        }
      };
    }

    const colIdx = columnIndex - 1;
    const originalCount = parsed.data.length;
    const filteredData = [];
    const excludedData = [];
    
    parsed.data.forEach(row => {
      const amount = Math.abs(cleanNumber(row[colIdx]));
      if (amount >= minValue) {
        filteredData.push(row);
      } else {
        excludedData.push(row);
      }
    });

    return {
      filtered: {
        headers: parsed.headers,
        data: filteredData
      },
      excludedData: {
        headers: parsed.headers,
        data: excludedData
      },
      excludedCount: originalCount - filteredData.length,
      originalCount: originalCount,
      minValue: minValue,
      originalParsed: parsed
    };
  };

  const displayResults = (parsed, selectedRows, columnIndex, filterResult, targetItems, idColumnIndex) => {
    const colIdx = columnIndex - 1;

    const filteredAmounts = parsed.data.map(row => cleanNumber(row[colIdx]));
    const samplingPopulationValue = filteredAmounts.reduce((sum, val) => sum + Math.abs(val), 0);

    let targetItemsTotal = 0;
    if (targetItems && targetItems.data && targetItems.data.length > 0) {
      const targetAmounts = targetItems.data.map(row => cleanNumber(row[colIdx]));
      targetItemsTotal = targetAmounts.reduce((sum, val) => sum + Math.abs(val), 0);
    }

    let excludedItemsTotal = 0;
    if (filterResult && filterResult.excludedData && filterResult.excludedData.data && filterResult.excludedData.data.length > 0) {
      const excludedAmounts = filterResult.excludedData.data.map(row => cleanNumber(row[colIdx]));
      excludedItemsTotal = excludedAmounts.reduce((sum, val) => sum + Math.abs(val), 0);
    }

    const selectedAmounts = selectedRows.map(row => cleanNumber(row[colIdx]));
    const selectedTotalValue = selectedAmounts.reduce((sum, val) => sum + Math.abs(val), 0);

    const populationWithoutExcluded = targetItemsTotal + samplingPopulationValue;
    const totalPopulation = targetItemsTotal + samplingPopulationValue + excludedItemsTotal;

    setSummary({
      targetItemsTotal,
      samplingPopulationValue,
      selectedTotalValue,
      populationWithoutExcluded,
      totalPopulation
    });

    setTargetItems(targetItems);
    setSelectedRows(selectedRows);
    setParsedHeaders(parsed.headers || selectedRows[0]?.map((_, idx) => `Column ${idx + 1}`));
    setShowResults(true);
    setShowTargetSection(targetItems && targetItems.data && targetItems.data.length > 0);

    if (filterResult && filterResult.excludedCount > 0) {
      setExclusionMessage(`Excluded ${filterResult.excludedCount} items below the threshold of ${formatCurrency(filterResult.minValue)}.`);
    } else {
      setExclusionMessage('');
    }

    setCurrentResults({
      targetItems: targetItems,
      sampledItems: {
        headers: parsed.headers || selectedRows[0]?.map((_, idx) => `Column ${idx + 1}`),
        rows: selectedRows
      },
      summary: {
        targetItemsTotal,
        samplingPopulationValue,
        selectedTotalValue,
        populationWithoutExcluded,
        totalPopulation
      }
    });
  };

  const generateRandomSample = () => {
    const parsed = parseInput();
    if (!parsed) return;

    const idColumnIndex = parseInt(idColumn) || 1;
    const columnIndex = parseInt(amountColumn);
    const sampleSizeNum = parseInt(sampleSize);
    const minValueNum = parseFloat(minValue) || 0;
    const targetValueNum = parseFloat(targetValue) || 0;

    if (!columnIndex || !sampleSizeNum) {
      alert('Please enter both Column Index and Sample Size.');
      return;
    }

    if (!validateAmountColumn(parsed, columnIndex)) return;

    const targetResult = identifyTargets(parsed, idColumnIndex, columnIndex, targetValueNum, targetIds);
    const targetItems = targetResult.targets;
    const remainingParsed = targetResult.remaining;

    const filterResult = filterByMinimumValue(remainingParsed, columnIndex, minValueNum);
    const filteredParsed = filterResult.filtered;
    filterResult.originalParsed = parsed;

    if (filteredParsed.data.length === 0) {
      alert('No items remain after applying target selection and minimum value filter.');
      return;
    }

    if (sampleSizeNum > filteredParsed.data.length) {
      alert(`Sample size (${sampleSizeNum}) cannot be greater than filtered population size (${filteredParsed.data.length}).`);
      return;
    }

    const indices = Array.from({ length: filteredParsed.data.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const selectedIndices = indices.slice(0, sampleSizeNum).sort((a, b) => a - b);
    const selectedRows = selectedIndices.map(idx => filteredParsed.data[idx]);

    displayResults(filteredParsed, selectedRows, columnIndex, filterResult, targetItems, idColumnIndex);
  };

  const generateMUSSample = () => {
    const parsed = parseInput();
    if (!parsed) return;

    const idColumnIndex = parseInt(idColumn) || 1;
    const columnIndex = parseInt(amountColumn);
    const sampleSizeNum = parseInt(sampleSize);
    const minValueNum = parseFloat(minValue) || 0;
    const targetValueNum = parseFloat(targetValue) || 0;

    if (!columnIndex || !sampleSizeNum) {
      alert('Please enter both Column Index and Sample Size.');
      return;
    }

    if (!validateAmountColumn(parsed, columnIndex)) return;

    const targetResult = identifyTargets(parsed, idColumnIndex, columnIndex, targetValueNum, targetIds);
    const targetItems = targetResult.targets;
    const remainingParsed = targetResult.remaining;

    const filterResult = filterByMinimumValue(remainingParsed, columnIndex, minValueNum);
    const filteredParsed = filterResult.filtered;
    filterResult.originalParsed = parsed;

    if (filteredParsed.data.length === 0) {
      alert('No items remain after applying target selection and minimum value filter.');
      return;
    }

    const colIdx = columnIndex - 1;

    const items = filteredParsed.data.map((row, index) => {
      const amount = Math.abs(cleanNumber(row[colIdx]));
      return {
        index: index,
        row: row,
        amount: amount
      };
    });

    const validItems = items.filter(item => item.amount > 0);

    if (validItems.length === 0) {
      alert('No items with positive amounts found in the specified column.');
      return;
    }

    const totalValue = validItems.reduce((sum, item) => sum + item.amount, 0);

    const cumulative = [];
    let cumSum = 0;
    validItems.forEach(item => {
      cumSum += item.amount;
      cumulative.push({
        item: item,
        cumulative: cumSum
      });
    });

    const selectedIndicesSet = new Set();
    const maxSamples = Math.min(sampleSizeNum * 10, validItems.length * 2);

    for (let i = 0; i < maxSamples && selectedIndicesSet.size < sampleSizeNum; i++) {
      const random = Math.random() * totalValue;
      
      for (let j = 0; j < cumulative.length; j++) {
        if (random <= cumulative[j].cumulative) {
          selectedIndicesSet.add(cumulative[j].item.index);
          break;
        }
      }
    }

    if (selectedIndicesSet.size < sampleSizeNum) {
      const remainingIndices = validItems
        .map((item, idx) => item.index)
        .filter(idx => !selectedIndicesSet.has(idx));
      
      const needed = sampleSizeNum - selectedIndicesSet.size;
      const additional = remainingIndices.slice(0, needed);
      additional.forEach(idx => selectedIndicesSet.add(idx));
    }

    const selectedIndices = Array.from(selectedIndicesSet).sort((a, b) => a - b);
    const selectedRows = selectedIndices.map(idx => filteredParsed.data[idx]);

    displayResults(filteredParsed, selectedRows, columnIndex, filterResult, targetItems, idColumnIndex);
  };

  const copyToExcel = async () => {
    if (!currentResults) {
      alert('No results to copy.');
      return;
    }

    try {
      let htmlContent = '';
      let plainText = '';

      const createSummaryTableHtml = (summary) => {
        if (!summary) return '';
        
        const values = [
          formatCurrency(summary.targetItemsTotal),
          formatCurrency(summary.samplingPopulationValue),
          formatCurrency(summary.selectedTotalValue),
          formatCurrency(summary.populationWithoutExcluded),
          formatCurrency(summary.totalPopulation)
        ];
        
        const headers = [
          'Target Items Total',
          'Sampling Population',
          'Sampled Items Total',
          'Population (w/o Excluded)',
          'Total Population'
        ];
        
        let html = `<h3>Summary</h3><table border="1" style="border-collapse: collapse;"><thead><tr>`;
        headers.forEach(h => html += `<th style="background-color: #f3f4f6; padding: 5px;">${h}</th>`);
        html += '</tr></thead><tbody><tr>';
        values.forEach(v => html += `<td style="padding: 5px;">${v}</td>`);
        html += '</tr></tbody></table><br/>';
        return html;
      };

      const createSummaryTsv = (summary) => {
        if (!summary) return '';
        
        const headers = [
          'Target Items Total',
          'Sampling Population',
          'Sampled Items Total',
          'Population (w/o Excluded)',
          'Total Population'
        ];
        
        const values = [
          formatCurrency(summary.targetItemsTotal),
          formatCurrency(summary.samplingPopulationValue),
          formatCurrency(summary.selectedTotalValue),
          formatCurrency(summary.populationWithoutExcluded),
          formatCurrency(summary.totalPopulation)
        ];
        
        let text = 'Summary\n';
        text += headers.join('\t') + '\n';
        text += values.join('\t') + '\n\n';
        return text;
      };

      const createTableHtml = (title, headers, rows) => {
        if (!rows || rows.length === 0) return '';
        
        let html = `<h3>${title}</h3><table border="1" style="border-collapse: collapse;"><thead><tr>`;
        headers.forEach(h => html += `<th style="background-color: #f3f4f6; padding: 5px;">${h}</th>`);
        html += '</tr></thead><tbody>';
        
        rows.forEach(row => {
          html += '<tr>';
          row.forEach(cell => {
            html += `<td style="padding: 5px;">${cell}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table><br/>';
        return html;
      };

      const createTsv = (title, headers, rows) => {
        if (!rows || rows.length === 0) return '';
        
        let text = `${title}\n`;
        text += headers.join('\t') + '\n';
        rows.forEach(row => {
          text += row.join('\t') + '\n';
        });
        text += '\n';
        return text;
      };

      if (currentResults.summary) {
        htmlContent += createSummaryTableHtml(currentResults.summary);
        plainText += createSummaryTsv(currentResults.summary);
      }

      if (currentResults.targetItems && currentResults.targetItems.data && currentResults.targetItems.data.length > 0) {
        const headers = currentResults.targetItems.headers || 
          (currentResults.targetItems.data[0] ? currentResults.targetItems.data[0].map((_, idx) => `Column ${idx + 1}`) : []);
        
        htmlContent += createTableHtml('Target Items', headers, currentResults.targetItems.data);
        plainText += createTsv('Target Items', headers, currentResults.targetItems.data);
      }

      if (currentResults.sampledItems && currentResults.sampledItems.rows && currentResults.sampledItems.rows.length > 0) {
        const headers = currentResults.sampledItems.headers || 
          (currentResults.sampledItems.rows[0] ? currentResults.sampledItems.rows[0].map((_, idx) => `Column ${idx + 1}`) : []);
        
        htmlContent += createTableHtml('Sampled Items', headers, currentResults.sampledItems.rows);
        plainText += createTsv('Sampled Items', headers, currentResults.sampledItems.rows);
      }

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

  const colIdx = amountColumn ? parseInt(amountColumn) - 1 : -1;
  const idColIdx = idColumn - 1;

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* Input Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Input Data</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Paste Excel Data</label>
          <textarea 
            value={dataInput}
            onChange={(e) => setDataInput(e.target.value)}
            rows={12}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
            placeholder="Paste your Excel data here... (Tab-separated values)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="hasHeaders" 
              checked={hasHeaders}
              onChange={(e) => setHasHeaders(e.target.checked)}
              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <label htmlFor="hasHeaders" className="ml-2 text-sm font-medium text-gray-700">
              First row contains headers
            </label>
          </div>
          
          <div>
            <label htmlFor="idColumn" className="block text-sm font-medium text-gray-700 mb-2">
              ID Column Index
            </label>
            <input 
              type="number" 
              id="idColumn" 
              min="1" 
              value={idColumn}
              onChange={(e) => setIdColumn(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="e.g., 1 (for column A)"
            />
          </div>
          
          <div>
            <label htmlFor="amountColumn" className="block text-sm font-medium text-gray-700 mb-2">
              Column Index for Amounts
            </label>
            <input 
              type="number" 
              id="amountColumn" 
              min="1" 
              value={amountColumn}
              onChange={(e) => setAmountColumn(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="e.g., 2 (for column B)"
            />
          </div>
          
          <div>
            <label htmlFor="sampleSize" className="block text-sm font-medium text-gray-700 mb-2">
              Sample Size
            </label>
            <input 
              type="number" 
              id="sampleSize" 
              min="1" 
              value={sampleSize}
              onChange={(e) => setSampleSize(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Number of items"
            />
          </div>
          
          <div>
            <label htmlFor="min-value-input" className="block text-sm font-medium text-gray-700 mb-2">
              Exclude items below (Abs Value)
            </label>
            <input 
              type="number" 
              id="min-value-input" 
              min="0" 
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="e.g. 5000"
            />
          </div>
        </div>

        {/* Target Testing Section */}
        <div className="bg-gray-50 rounded-lg border border-gray-300 p-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Target Testing (100% Selection)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="targetValue" className="block text-sm font-medium text-gray-700 mb-2">
                Select all items above (Abs Value)
              </label>
              <input 
                type="number" 
                id="targetValue" 
                min="0" 
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="e.g., 50000"
              />
            </div>
            <div>
              <label htmlFor="targetIds" className="block text-sm font-medium text-gray-700 mb-2">
                Select specific IDs (comma separated)
              </label>
              <input 
                type="text" 
                id="targetIds" 
                value={targetIds}
                onChange={(e) => setTargetIds(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="e.g., INV-1001, INV-1005"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={generateRandomSample}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-sm"
          >
            Random Sample
          </button>
          <button 
            onClick={generateMUSSample}
            className="flex-1 bg-red-800 hover:bg-red-900 text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-sm"
          >
            Monetary Unit Sample (Weighted)
          </button>
        </div>
      </div>

      {/* Output Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Sample Results</h2>
          {showResults && (
            <button 
              onClick={copyToExcel}
              className={`${copyButtonClass} text-white font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm text-sm`}
            >
              {copyButtonText}
            </button>
          )}
        </div>
        
        {/* Summary */}
        {summary && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-red-700 font-medium mb-1">Target Items Total</div>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(summary.targetItemsTotal)}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-red-700 font-medium mb-1">Sampling Population</div>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(summary.samplingPopulationValue)}</div>
            </div>
            <div className="bg-red-100 rounded-lg p-4 border border-red-300">
              <div className="text-sm text-red-800 font-medium mb-1">Sampled Items Total</div>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(summary.selectedTotalValue)}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-red-700 font-medium mb-1">Population (w/o Excluded)</div>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(summary.populationWithoutExcluded)}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-red-700 font-medium mb-1">Total Population</div>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(summary.totalPopulation)}</div>
            </div>
          </div>
        )}

        {/* Target Items Table */}
        {showTargetSection && targetItems && targetItems.data && targetItems.data.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Target / Key Items (100% Tested)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    {(targetItems.headers || targetItems.data[0]?.map((_, idx) => `Column ${idx + 1}`)).map((header, idx) => (
                      <th
                        key={idx}
                        className={`px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border border-gray-300 ${
                          idx === colIdx ? 'bg-red-100' : ''
                        } ${idx === idColIdx ? 'bg-blue-100' : ''}`}
                      >
                        {header}
                        {idx === colIdx && ' (Amount)'}
                        {idx === idColIdx && ' (ID)'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targetItems.data.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50 bg-yellow-50">
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className={`px-4 py-2 text-sm text-gray-700 border border-gray-300 ${
                            cellIdx === colIdx ? 'font-semibold text-red-900 bg-red-50' : ''
                          } ${cellIdx === idColIdx ? 'font-semibold text-blue-900 bg-blue-50' : ''}`}
                        >
                          {cellIdx === colIdx ? formatCurrency(cleanNumber(cell)) : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Table */}
        {showResults && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Randomly Selected Samples</h3>
            {exclusionMessage && (
              <div className="mb-4 text-sm text-gray-600">{exclusionMessage}</div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    {parsedHeaders?.map((header, idx) => (
                      <th
                        key={idx}
                        className={`px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border border-gray-300 ${
                          idx === colIdx ? 'bg-red-100' : ''
                        }`}
                      >
                        {header}
                        {idx === colIdx && ' (Amount)'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50">
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className={`px-4 py-2 text-sm text-gray-700 border border-gray-300 ${
                            cellIdx === colIdx ? 'font-semibold text-red-900 bg-red-50' : ''
                          }`}
                        >
                          {cellIdx === colIdx ? formatCurrency(cleanNumber(cell)) : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!showResults && (
          <div className="text-center py-12 text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p>No sample generated yet. Paste your data and select a sampling method.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditSampler;

