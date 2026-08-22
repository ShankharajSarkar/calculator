/**
 * ==========================================================================
 * ADVANCED SIP & GOAL-SEEK ENGINE (sip-calculator.js)
 * ==========================================================================
 */

'use strict';

/**
 * Pure calculation function for SIP schedules
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
    if (isStepUp && month > 1 && (month - 1) % 12 === 0) {
      currentMonthlyInvestment += currentMonthlyInvestment * (stepUpPercent / 100);
    }

    cumulativeInvested += currentMonthlyInvestment;
    yearInvestedAccumulator += currentMonthlyInvestment;
    currentPortfolioValue = (currentPortfolioValue + currentMonthlyInvestment) * (1 + monthlyRate);

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

/**
 * Reverse SIP (Goal-Seek): Calculates required monthly investment for target corpus
 */
function solveRequiredMonthlySip({ targetCorpus, annualRate, tenureYears }) {
  const i = annualRate / 12 / 100;
  const n = tenureYears * 12;
  // Formula: P = FV / [ ((1 + i)^n - 1) / i * (1 + i) ]
  const factor = ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
  return Math.round(targetCorpus / factor);
}

// Controller & DOM Binding
document.addEventListener('DOMContentLoaded', () => {
  let donutChartInstance = null;
  let growthChartInstance = null;
  let currentMode = 'forward'; // 'forward' or 'reverse'
  let cachedBreakdown = [];

  // DOM Elements
  const tabForward = document.getElementById('tabForward');
  const tabReverse = document.getElementById('tabReverse');
  const groupMonthly = document.getElementById('groupMonthlyInvestment');
  const groupTarget = document.getElementById('groupTargetGoal');
  const currencySelector = document.getElementById('currencySelector');
  const stepUpToggle = document.getElementById('stepUpToggle');
  const stepUpContainer = document.getElementById('stepUpContainer');
  const inflationToggle = document.getElementById('inflationToggle');
  const inflationContainer = document.getElementById('inflationContainer');
  const tableBody = document.getElementById('breakdownTableBody');
  const tableToggleBtn = document.getElementById('tableToggleBtn');
  const tableCollapseContainer = document.getElementById('tableCollapseContainer');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');
  const resetBtn = document.getElementById('resetBtn');
  const milestoneContainer = document.getElementById('milestoneBadgesContainer');

  // Bind synced controls
  FinanceUtils.bindInputSliderPair('monthlyInvestmentNum', 'monthlyInvestmentSlider', triggerRecalculation);
  FinanceUtils.bindInputSliderPair('targetGoalNum', 'targetGoalSlider', triggerRecalculation);
  FinanceUtils.bindInputSliderPair('returnRateNum', 'returnRateSlider', triggerRecalculation);
  FinanceUtils.bindInputSliderPair('tenureNum', 'tenureSlider', triggerRecalculation);
  FinanceUtils.bindInputSliderPair('stepUpPercentNum', 'stepUpPercentSlider', triggerRecalculation);
  FinanceUtils.bindInputSliderPair('inflationRateNum', 'inflationRateSlider', triggerRecalculation);

  // Tab switching
  tabForward.addEventListener('click', () => setMode('forward'));
  tabReverse.addEventListener('click', () => setMode('reverse'));

  function setMode(mode) {
    currentMode = mode;
    if (mode === 'forward') {
      tabForward.style.background = 'var(--color-primary)';
      tabForward.style.color = '#fff';
      tabReverse.style.background = 'var(--bg-surface)';
      tabReverse.style.color = 'var(--text-muted)';
      groupMonthly.style.display = 'block';
      groupTarget.style.display = 'none';
      document.getElementById('highlightMetricLabel').textContent = 'Total Maturity Corpus';
      document.getElementById('primaryMetricLabel').textContent = 'Total Invested';
    } else {
      tabReverse.style.background = 'var(--color-primary)';
      tabReverse.style.color = '#fff';
      tabForward.style.background = 'var(--bg-surface)';
      tabForward.style.color = 'var(--text-muted)';
      groupMonthly.style.display = 'none';
      groupTarget.style.display = 'block';
      document.getElementById('highlightMetricLabel').textContent = 'Required Monthly SIP';
      document.getElementById('primaryMetricLabel').textContent = 'Total Investment Outlay';
    }
    triggerRecalculation();
  }

  // Toggles
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

  exportCsvBtn.addEventListener('click', exportTableToCsv);
  copyShareLinkBtn.addEventListener('click', copyShareableUrl);
  resetBtn.addEventListener('click', resetDefaults);

  function updateCurrencyPrefixes() {
    const symbol = FinanceUtils.CURRENCY_CONFIGS[currencySelector.value].symbol;
    document.querySelectorAll('.currency-symbol-label').forEach(el => el.textContent = symbol);
  }

  function getFormValues() {
    return {
      monthlyInvestment: parseFloat(document.getElementById('monthlyInvestmentNum').value) || 0,
      targetGoal: parseFloat(document.getElementById('targetGoalNum').value) || 0,
      annualRate: parseFloat(document.getElementById('returnRateNum').value) || 0,
      tenureYears: parseInt(document.getElementById('tenureNum').value, 10) || 1,
      isStepUp: stepUpToggle.checked,
      stepUpPercent: parseFloat(document.getElementById('stepUpPercentNum').value) || 0,
      isInflationAdjusted: inflationToggle.checked,
      inflationRate: parseFloat(document.getElementById('inflationRateNum').value) || 0,
      currency: currencySelector.value
    };
  }

  function renderMilestones(breakdown, currency) {
    const milestones = [
      { label: '₹25 Lakh', target: 2500000 },
      { label: '₹50 Lakh', target: 5000000 },
      { label: '₹1 Crore', target: 10000000 },
      { label: '₹5 Crore', target: 50000000 }
    ];

    milestoneContainer.innerHTML = milestones.map(m => {
      const hit = breakdown.find(row => row.cumulativeValue >= m.target);
      const badgeText = hit ? `Achieved in Year ${hit.year}` : 'Beyond tenure';
      const badgeColor = hit ? 'var(--color-primary-light)' : 'var(--bg-subtle)';
      const textColor = hit ? 'var(--color-primary-dark)' : 'var(--text-light)';
      
      return `
        <div style="background: ${badgeColor}; padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); font-size: 0.8rem;">
          <strong style="color: var(--text-main);">${m.label}:</strong> 
          <span style="color: ${textColor}; font-weight: 600;">${badgeText}</span>
        </div>
      `;
    }).join('');
  }

  function renderResults(results, values, requiredSip = null) {
    cachedBreakdown = results.yearlyBreakdown;

    if (currentMode === 'reverse' && requiredSip !== null) {
      document.getElementById('maturityValueDisplay').textContent = 
        FinanceUtils.formatCurrency(requiredSip, values.currency);
      document.getElementById('totalInvestedDisplay').textContent = 
        FinanceUtils.formatCurrency(results.totalInvested, values.currency);
      document.getElementById('totalReturnsDisplay').textContent = 
        FinanceUtils.formatCurrency(results.totalReturns, values.currency);
    } else {
      document.getElementById('totalInvestedDisplay').textContent = 
        FinanceUtils.formatCurrency(results.totalInvested, values.currency);
      document.getElementById('totalReturnsDisplay').textContent = 
        FinanceUtils.formatCurrency(results.totalReturns, values.currency);
      document.getElementById('maturityValueDisplay').textContent = 
        FinanceUtils.formatCurrency(results.maturityValue, values.currency);
    }

    const inflationSubtext = document.getElementById('realValueSubtext');
    if (values.isInflationAdjusted && currentMode === 'forward') {
      inflationSubtext.style.display = 'block';
      inflationSubtext.textContent = `Purchasing Power: ${FinanceUtils.formatCurrency(results.realMaturityValue, values.currency)}`;
    } else {
      inflationSubtext.style.display = 'none';
    }

    renderMilestones(results.yearlyBreakdown, values.currency);

    // Donut Chart
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
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          cutout: '70%'
        }
      });
    }

    // Growth Line Chart
    const lineCtx = document.getElementById('growthChartCanvas').getContext('2d');
    const labels = results.yearlyBreakdown.map(i => `Yr ${i.year}`);
    const investedData = results.yearlyBreakdown.map(i => i.cumulativeInvested);
    const corpusData = results.yearlyBreakdown.map(i => i.cumulativeValue);

    if (growthChartInstance) {
      growthChartInstance.data.labels = labels;
      growthChartInstance.data.datasets[0].data = investedData;
      growthChartInstance.data.datasets[1].data = corpusData;
      growthChartInstance.update();
    } else {
      growthChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            { label: 'Total Invested', data: investedData, borderColor: FinanceUtils.ChartTheme.investedColor, fill: false },
            { label: 'Corpus Value', data: corpusData, borderColor: FinanceUtils.ChartTheme.returnsColor, fill: true, backgroundColor: 'rgba(0,208,156,0.1)' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { ticks: { callback: val => FinanceUtils.formatCompact(val, values.currency) } }
          }
        }
      });
    }

    // Table view
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

    if (currentMode === 'reverse') {
      const requiredMonthly = solveRequiredMonthlySip({
        targetCorpus: values.targetGoal,
        annualRate: values.annualRate,
        tenureYears: values.tenureYears
      });

      const schedule = calculateSipSchedule({
        monthlyInvestment: requiredMonthly,
        annualRate: values.annualRate,
        tenureYears: values.tenureYears,
        isStepUp: false,
        isInflationAdjusted: false
      });

      renderResults(schedule, values, requiredMonthly);
    } else {
      const results = calculateSipSchedule(values);
      renderResults(results, values);
    }
  }

  const debouncedCalculate = FinanceUtils.debounce(executeCalculation, 20);
  function triggerRecalculation() { debouncedCalculate(); }

  function exportTableToCsv() {
    if (!cachedBreakdown || cachedBreakdown.length === 0) return;
    let csv = 'Year,Invested This Year,Cumulative Invested,Returns This Year,Ending Corpus\n';
    cachedBreakdown.forEach(r => {
      csv += `${r.year},${r.investedThisYear},${r.cumulativeInvested},${r.returnsThisYear},${r.cumulativeValue}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sip-investment-schedule.csv';
    link.click();
  }

  function copyShareableUrl() {
    const v = getFormValues();
    const params = new URLSearchParams({
      mode: currentMode,
      sip: v.monthlyInvestment,
      goal: v.targetGoal,
      rate: v.annualRate,
      years: v.tenureYears,
      stepup: v.isStepUp ? v.stepUpPercent : 0,
      curr: v.currency
    });
    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      copyShareLinkBtn.textContent = '✓ Copied!';
      setTimeout(() => copyShareLinkBtn.textContent = '🔗 Share Link', 2000);
    });
  }

  function loadUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('rate')) return;

    if (params.get('mode') === 'reverse') setMode('reverse');
    if (params.has('sip')) {
      document.getElementById('monthlyInvestmentNum').value = params.get('sip');
      document.getElementById('monthlyInvestmentSlider').value = params.get('sip');
    }
    if (params.has('goal')) {
      document.getElementById('targetGoalNum').value = params.get('goal');
      document.getElementById('targetGoalSlider').value = params.get('goal');
    }
    if (params.has('rate')) {
      document.getElementById('returnRateNum').value = params.get('rate');
      document.getElementById('returnRateSlider').value = params.get('rate');
    }
    if (params.has('years')) {
      document.getElementById('tenureNum').value = params.get('years');
      document.getElementById('tenureSlider').value = params.get('years');
    }
    if (params.has('stepup') && parseFloat(params.get('stepup')) > 0) {
      stepUpToggle.checked = true;
      stepUpContainer.classList.add('is-active');
      document.getElementById('stepUpPercentNum').value = params.get('stepup');
      document.getElementById('stepUpPercentSlider').value = params.get('stepup');
    }
    if (params.has('curr')) {
      currencySelector.value = params.get('curr');
    }
  }

  function resetDefaults() {
    setMode('forward');
    document.getElementById('monthlyInvestmentNum').value = 10000;
    document.getElementById('monthlyInvestmentSlider').value = 10000;
    document.getElementById('targetGoalNum').value = 10000000;
    document.getElementById('targetGoalSlider').value = 10000000;
    document.getElementById('returnRateNum').value = 12;
    document.getElementById('returnRateSlider').value = 12;
    document.getElementById('tenureNum').value = 10;
    document.getElementById('tenureSlider').value = 10;
    stepUpToggle.checked = false;
    stepUpContainer.classList.remove('is-active');
    inflationToggle.checked = false;
    inflationContainer.classList.remove('is-active');
    currencySelector.value = 'INR';
    updateCurrencyPrefixes();
    executeCalculation();
  }

  // Init
  loadUrlParams();
  updateCurrencyPrefixes();
  executeCalculation();
});
