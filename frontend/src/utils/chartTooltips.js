// src/utils/chartTooltips.js

/**
 * Creates Chart.js options with customized tooltip callback
 * that renders bulleted list of item names (projects, employees, clients).
 * 
 * @param {Function} getItemsForCategory - (categoryLabel: string) => string[]
 * @param {Object} extraOptions - additional Chart.js options
 */
export function buildNameTooltipOptions(getItemsForCategory, extraOptions = {}) {
  const { plugins = {}, scales = {}, ...rest } = extraOptions;

  return {
    responsive: true,
    maintainAspectRatio: false,
    ...rest,
    plugins: {
      legend: { display: false, ...plugins.legend },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        titleColor: '#F8FAFC',
        bodyColor: '#E2E8F0',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
        padding: 12,
        boxPadding: 4,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed.y !== undefined && context.parsed.y !== null ? context.parsed.y : context.parsed;
            return `Count: ${value}`;
          },
          afterBody: (tooltipItems) => {
            if (!tooltipItems || !tooltipItems.length) return [];
            const category = tooltipItems[0].label;
            const names = getItemsForCategory(category) || [];
            if (!names || names.length === 0) return ['', 'Names: None'];
            
            const maxShow = 10;
            const shown = names.slice(0, maxShow).map(name => ` • ${name}`);
            if (names.length > maxShow) {
              shown.push(` • ...and ${names.length - maxShow} more`);
            }
            return ['', 'Names / Details:'].concat(shown);
          },
          ...plugins.tooltip?.callbacks
        },
        ...plugins.tooltip
      },
      ...plugins
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        ...scales.y
      },
      ...scales
    }
  };
}
