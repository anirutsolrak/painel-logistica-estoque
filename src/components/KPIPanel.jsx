import React, { useMemo } from 'react';
import TruncatedTextWithPopover from './TruncatedTextWithPopover';

function KPIPanel({ title, value, unit, comparison }) {
    const reportError = (error) => console.error("KPIPanel Error:", error);

    const formatValue = (val, u) => {
         if (val == null || val === undefined) return '-';
         if (typeof val === 'number') {
             let options = {};
             if (u === 'currency') {
                  options = { minimumFractionDigits: 2, maximumFractionDigits: 2, style: 'currency', currency: 'BRL' };
                  return val.toLocaleString('pt-BR', options);
             } else {
                  options = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
                  // Abbreviate large numbers (M for million, K for thousand)
                  const absVal = Math.abs(val);
                  if (absVal >= 1e6) {
                      return (val / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M';
                  }
                  if (absVal >= 1e3) {
                       return (val / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' K';
                  }
                  return val.toLocaleString('pt-BR', options);
              }
         }
         return String(val);
     };

    const formatComparison = (compVal, compTitle) => {
         if (typeof compVal === 'number' && !isNaN(compVal) && compTitle && compTitle.includes('Contas Ativas')) {
             const adjustedAvg = compVal;
             const options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
             return `Média período: ${adjustedAvg.toLocaleString('pt-BR', options)}`;
         }
         if (React.isValidElement(compVal)) {
             return compVal;
         }
         return compVal != null ? String(compVal) : '';
     };

     const formattedValue = useMemo(() => formatValue(value, unit), [value, unit]);
     const formattedComparison = useMemo(() => formatComparison(comparison, title), [comparison, title]);


    try {
        return (
            React.createElement('div', {
                className: "kpi-card bg-white p-4 rounded-lg shadow-md border border-gray-100 flex flex-col justify-between min-h-[100px]",
                'data-name': `kpi-panel-${title?.toLowerCase().replace(/\s+/g, '-')}`
            },
                React.createElement('div', { className: "overflow-hidden" },
                    React.createElement('div', { className: "w-full" },
                        React.createElement(TruncatedTextWithPopover, {
                            className: "kpi-title text-sm font-medium text-gray-500 mb-1 block",
                            title: title
                        },
                            title
                        )
                    ),
                    React.createElement('div', { className: "w-full" },
                        React.createElement(TruncatedTextWithPopover, {
                            className: "kpi-value text-3xl font-semibold text-gray-800 block",
                            title: typeof formattedValue === 'string' ? formattedValue : undefined
                        },
                            formattedValue
                        )
                    )
                ),
                formattedComparison ? React.createElement('div', { className: "w-full mt-1" },
                    React.createElement(TruncatedTextWithPopover, {
                        className: "kpi-comparison text-xs text-gray-600 block",
                        title: typeof formattedComparison === 'string' ? formattedComparison : undefined
                    },
                        formattedComparison
                    )
                ) : null
            )
        );
     } catch (error) {
         console.error('KPIPanel component error:', error);
         reportError(error);
         return <div className="kpi-card error p-4 flex items-center justify-center text-red-500">Erro no KPI</div>;
     }
}

export default KPIPanel;