/**
 * ==========================================================================
 * ADVANCED SIP CALCULATOR LOGIC (sip-calculator.js)
 * ==========================================================================
 */

'use strict';

/**
 * Pure calculation function for SIP schedules
 * Decoupled from DOM for easy unit testing and reuse across calculators
 */
function calculateSipSchedule({
  monthlyInvestment,
  annualRate,
  tenureYears,
  isStepUp = false,
  stepUpPercent = 0,
  isInflationAdjusted = false,
  inflationRate = 0
}) {
  const monthlyRate = annualRate / 12 / 100;
  const totalMonths = tenureYears * 12;

  let currentMonthlyInvestment = monthlyInvestment;
  let cumulativeInvested = 0;
  let currentPortfolioValue = 0;
  const yearlyBreakdown = [];

  let yearInvestedAccumulator = 0;
  let yearStartValue = 0;

  for (let month = 1; month <= totalMonths; month++) {
    // Annual Step-Up applied at the start of each subsequent year (month 13, 25, etc.)
    if (isStepUp && month > 1 && (month - 1) % 12 === 0) {
      currentMonthlyInvestment += currentMonthlyInvestment * (stepUpPercent / 100);
    }

    cumulativeInvested += currentMonthlyInvestment;
    yearInvestedAccumulator += currentMonthlyInvestment;

    // Monthly compounding step: Add investment and apply monthly return
    currentPortfolioValue = (currentPortfolioValue + currentMonthlyInvestment) * (1 + monthlyRate);

    // Record breakdown snapshots at the end of each year
    if (month % 12 === 0) {
      const yearNumber = month / 12;
      const yearEndValue = currentPortfolioValue;
      const yearReturns = (yearEndValue - yearStartValue) - yearInvestedAccumulator;

      yearlyBreakdown.push({
        year: yearNumber,
        investedThisYear: Math.round(yearInvestedAccumulator),
        cumulativeInvested: Math.round(cumulativeInvested),
        cumulativeValue: Math.round(yearEndValue),
        returnsThisYear: Math.round(yearReturns)
      });

      yearStartValue = yearEndValue;
      yearInvestedAccumulator = 0;
    }
  }

  const maturityValue = Math.round(currentPortfolioValue);
  const totalInvested = Math.round(cumulativeInvested);
  const totalReturns = Math.max(0, maturityValue - totalInvested);

  // Inflation adjusted real future value: Real FV = Nominal FV / (1 + r)^n
  let realMaturityValue = maturityValue;
  if (isInflationAdjusted && inflationRate > 0) {
    realMaturityValue = Math.round(maturityValue / Math.pow(1 + inflationRate / 100, tenureYears));
  }

  return {
    totalInvested,
    totalReturns,
    maturityValue,
    realMaturityValue,
    yearlyBreakdown
  };
}

// Controller & DOM Binding Layer
document.addEventListener('DOMContentLoaded', () => {
  let donutChartInstance = null;
  let growthChartInstance = null;

  // DOM Elements
  const currencySelector = document.getElementById('currencySelector');
  const stepUpToggle = document.getElementById('stepUpToggle');
  const stepUpContainer = document.getElementById('stepUpContainer');
  const inflationToggle = document.getElementById('inflationToggle');
  const inflationContainer = document.getElementById('inflationContainer');
  const tableBody = document.getElementById('breakdownTableBody');
  const tableToggleBtn = document.getElementById('tableToggleBtn');
  const tableCollapseContainer = document.getElementById('tableCollapseContainer');
  const resetBtn = document.getElementById('resetBtn');

  // Input bindings
  FinanceUtils.bindInputSliderPair('monthlyInvestmentNum', 'monthlyInvestmentSlider', triggerRecalculation);
  FinanceUtils.bindInputSliderPair('returnRateNum', 'returnRateSlider', triggerRecalculation);
  FinanceUtils.bindInputSliderPair('tenureNum', 'tenureSlider', triggerRecalculation);
  FinanceUtils.bindInputSliderPair('stepUpPercentNum', 'stepUpPercentSlider', triggerRecalculation);
  FinanceUtils.bindInputSliderPair('inflationRateNum', 'inflationRateSlider', triggerRecalculation);

  // Toggles & Selects
  stepUpToggle.addEventListener('change', () => {
    stepUpContainer.classList.toggle('is-active', stepUpToggle.checked);
    triggerRecalculation();
  });

  inflationToggle.addEventListener('change', () => {
    inflationContainer.classList.toggle('is-active', inflationToggle.checked);
    triggerRecalculation();
  });

  currencySelector.addEventListener('change', () => {
    updateCurrencyPrefixes();
    triggerRecalculation();
  });

  tableToggleBtn.addEventListener('click', () => {
    const isHidden = tableCollapseContainer.style.display === 'none';
    tableCollapseContainer.style.display = isHidden ? 'block' : 'none';
    tableToggleBtn.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';
  });

  resetBtn.addEventListener('click', resetDefaults);

  function updateCurrencyPrefixes() {
    const symbol = FinanceUtils.CURRENCY_CONFIGS[currencySelector.value].symbol;
    document.querySelectorAll('.currency-symbol-label').forEach(el => el.textContent = symbol);
  }

  function getFormValues() {
    return {
      monthlyInvestment: parseFloat(document.getElementById('monthlyInvestmentNum').value) || 0,
      annualRate: parseFloat(document.getElementById('returnRateNum').value) || 0,
      tenureYears: parseInt(document.getElementById('tenureNum').value, 10) || 1,
      isStepUp: stepUpToggle.checked,
      stepUpPercent: parseFloat(document.getElementById('stepUpPercentNum').value) || 0,
      isInflationAdjusted: inflationToggle.checked,
      inflationRate: parseFloat(document.getElementById('inflationRateNum').value) || 0,
      currency: currencySelector.value
    };
  }

  function renderResults(results, values) {
    // 1. Text Summary Cards
    document.getElementById('totalInvestedDisplay').textContent = 
      FinanceUtils.formatCurrency(results.totalInvested, values.currency);
    document.getElementById('totalReturnsDisplay').textContent = 
      FinanceUtils.formatCurrency(results.totalReturns, values.currency);
    document.getElementById('maturityValueDisplay').textContent = 
      FinanceUtils.formatCurrency(results.maturityValue, values.currency);

    const inflationSubtext = document.getElementById('realValueSubtext');
    if (values.isInflationAdjusted) {
      inflationSubtext.style.display = 'block';
      inflationSubtext.textContent = `Purchasing Power Value: ${FinanceUtils.formatCurrency(results.realMaturityValue, values.currency)}`;
    } else {
      inflationSubtext.style.display = 'none';
    }

    // 2. Donut Chart (Invested vs Gain)
    const donutCtx = document.getElementById('donutChartCanvas').getContext('2d');
    if (donutChartInstance) {
      donutChartInstance.data.datasets[0].data = [results.totalInvested, results.totalReturns];
      donutChartInstance.update();
    } else {
      donutChartInstance = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: ['Invested Amount', 'Est. Returns'],
          datasets: [{
            data: [results.totalInvested, results.totalReturns],
            backgroundColor: [FinanceUtils.ChartTheme.investedColor, FinanceUtils.ChartTheme.returnsColor],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: FinanceUtils.ChartTheme.fontFamily } } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${FinanceUtils.formatCurrency(ctx.raw, values.currency)}`
              }
            }
          },
          cutout: '70%'
        }
      });
    }

    // 3. Line/Area Chart (Year-on-Year Trajectory)
    const lineCtx = document.getElementById('growthChartCanvas').getContext('2d');
    const labels = results.yearlyBreakdown.map(item => `Yr ${item.year}`);
    const investedSeries = results.yearlyBreakdown.map(item => item.cumulativeInvested);
    const valueSeries = results.yearlyBreakdown.map(item => item.cumulativeValue);

    if (growthChartInstance) {
      growthChartInstance.data.labels = labels;
      growthChartInstance.data.datasets[0].data = investedSeries;
      growthChartInstance.data.datasets[1].data = valueSeries;
      growthChartInstance.options.scales.y.ticks.callback = (val) => FinanceUtils.formatCompact(val, values.currency);
      growthChartInstance.update();
    } else {
      growthChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Total Invested',
              data: investedSeries,
              borderColor: FinanceUtils.ChartTheme.investedColor,
              backgroundColor: 'rgba(71, 85, 105, 0.1)',
              fill: true,
              tension: 0.2
            },
            {
              label: 'Future Value',
              data: valueSeries,
              borderColor: FinanceUtils.ChartTheme.returnsColor,
              backgroundColor: 'rgba(0, 208, 156, 0.15)',
              fill: true,
              tension: 0.2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { family: FinanceUtils.ChartTheme.fontFamily } } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${FinanceUtils.formatCurrency(ctx.raw, values.currency)}`
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: FinanceUtils.ChartTheme.gridColor },
              ticks: { callback: (val) => FinanceUtils.formatCompact(val, values.currency) }
            }
          }
        }
      });
    }

    // 4. Populate Table
    tableBody.innerHTML = results.yearlyBreakdown.map(row => `
      <tr>
        <td>Year ${row.year}</td>
        <td>${FinanceUtils.formatCurrency(row.investedThisYear, values.currency)}</td>
        <td>${FinanceUtils.formatCurrency(row.cumulativeInvested, values.currency)}</td>
        <td>${FinanceUtils.formatCurrency(row.returnsThisYear, values.currency)}</td>
        <td><strong>${FinanceUtils.formatCurrency(row.cumulativeValue, values.currency)}</strong></td>
      </tr>
    `).join('');
  }

  function executeCalculation() {
    const values = getFormValues();
    const results = calculateSipSchedule(values);
    renderResults(results, values);
  }

  const debouncedCalculate = FinanceUtils.debounce(executeCalculation, 20);

  function triggerRecalculation() {
    debouncedCalculate();
  }

  function resetDefaults() {
    document.getElementById('monthlyInvestmentNum').value = 10000;
    document.getElementById('monthlyInvestmentSlider').value = 10000;
    document.getElementById('returnRateNum').value = 12;
    document.getElementById('returnRateSlider').value = 12;
    document.getElementById('tenureNum').value = 10;
    document.getElementById('tenureSlider').value = 10;
    
    stepUpToggle.checked = false;
    stepUpContainer.classList.remove('is-active');
    document.getElementById('stepUpPercentNum').value = 10;
    document.getElementById('stepUpPercentSlider').value = 10;

    inflationToggle.checked = false;
    inflationContainer.classList.remove('is-active');
    document.getElementById('inflationRateNum').value = 6;
    document.getElementById('inflationRateSlider').value = 6;

    currencySelector.value = 'INR';
    updateCurrencyPrefixes();
    executeCalculation();
  }

  // Initial Boot
  updateCurrencyPrefixes();
  executeCalculation();
});
