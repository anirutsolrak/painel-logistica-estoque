import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { reportError } from '../utils/helpers';
import { Chart } from 'chart.js/auto';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

import ErrorDisplay from '../components/ErrorDisplay';
import DashboardFilters from '../components/DashboardFilters';
import KPIPanel from '../components/KPIPanel';
import TruncatedTextWithPopover from '../components/TruncatedTextWithPopover';
import ChartComponent from '../components/ChartComponent';
import LoadingSpinner from '../components/LoadingSpinner';
import PeriodFilter from '../components/PeriodFilter';
import LoadingOverlay from '../components/LoadingOverlay';

import LogisticsService from '../utils/logisticsService';
import EstoqueService from '../utils/EstoqueService';
import getSupabaseClient from '../utils/supabaseClient';
import { FilterContext } from '../contexto/FilterContext';

const formatDate = (dateString) => { if (!dateString) return ''; try { const date = new Date(dateString); if (isNaN(date.getTime())) return dateString; return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); } catch (e) { return dateString; } };
// Updated formatNumber to remove K/M abbreviations
const formatNumber = (value, decimals = 0, isCurrency = false) => {
    if (value === null || value === undefined) {
        return decimals === 0 ? 'N/D' : (isCurrency ? 'R$ --,--' : 'N/D');
    }
    const num = Number(value);
    if (isNaN(num)) {
        return decimals === 0 ? 'Invál.' : (isCurrency ? 'R$ Invál.' : 'Invál.');
    }
    const options = {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    };
    if (isCurrency) {
        options.style = 'currency';
        options.currency = 'BRL';
    }
    return num.toLocaleString('pt-BR', options);
};
const formatPercent = (value, decimals = 1) => { if (value === null || value === undefined || isNaN(Number(value))) return '-'; const num = Number(value); return num.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals }); };
const calculatePercentageChange = (current, previous) => { if (previous === null || previous === undefined || previous === 0 || current === null || current === undefined) { return null; } return ((current - previous) / Math.abs(previous)) * 100; };
const getPreviousPeriodEndDate = (startDateStr) => { try { const start = new Date(startDateStr + 'T00:00:00Z'); if (isNaN(start.getTime())) return null; const prevEndDate = new Date(start.getTime() - 24 * 60 * 60 * 1000); return prevEndDate.toISOString().split('T')[0]; } catch (e) { return null; } };
const getPreviousPeriodStartDate = (startDateStr, endDateStr) => { try { const start = new Date(startDateStr + 'T00:00:00Z'); const end = new Date(endDateStr + 'T00:00:00Z'); if (isNaN(start.getTime()) || isNaN(end.getTime())) return null; const diff = end.getTime() - start.getTime(); if (diff < 0) return null; const prevEndDate = new Date(start.getTime() - 24 * 60 * 60 * 1000); const prevStartDate = new Date(prevEndDate.getTime() - diff); return prevStartDate.toISOString().split('T')[0]; } catch(e) { return null; }};
const formatUpdateTime = (timestamp) => { if (!timestamp) return 'N/A'; try { const date = new Date(timestamp); return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return 'Data inválida'; } };
const renderComparison = (currentValue, previousValue) => { const change = calculatePercentageChange(currentValue, previousValue); if (change === null) { return <span className="text-xs text-gray-400 italic">N/D</span>; } let iC = 'fa-solid fa-minus', tC = 'text-gray-500'; let cT = formatPercent(change / 100, 1); if (change > 0.1) { iC = 'fa-solid fa-arrow-up'; tC = 'text-green-600'; cT = `+${cT}`; } else if (change < -0.1) { iC = 'fa-solid fa-arrow-down'; tC = 'text-red-600'; } return <span className={`text-xs ${tC} inline-flex items-center gap-1 whitespace-nowrap`}><i className={iC}></i><span>{cT}</span><span className="text-gray-400">(vs ant.)</span></span>; };

const CACHE_EXPIRY_MS = 5 * 60 * 1000;

export default function Dashboard({ user }) {
    const { period, cachedData, updateCache } = useContext(FilterContext);
    const [filtros, setFiltros] = useState({});
    const [error, setError] = useState(null);
    const [logisticsError, setLogisticsError] = useState(null);
    const [stockError, setStockError] = useState(null);
    const [expandedRegion, setExpandedRegion] = useState(null);
    const [isLogisticsExpanded, setIsLogisticsExpanded] = useState(false);
    const [isStockExpanded, setIsStockExpanded] = useState(false);
    const [isCycleExpanded, setIsCycleExpanded] = useState(false);
    const [logisticsKpiData, setLogisticsKpiData] = useState(null);
    const [stockKpiData, setStockKpiData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdateTimes, setLastUpdateTimes] = useState({ logistics: null, stock: null });
    const [logisticsTimeSeriesData, setLogisticsTimeSeriesData] = useState([]);
    const [destructionReasonData, setDestructionReasonData] = useState([]);
    const [regionalData, setRegionalData] = useState({});
    const [consolidatedRegionalData, setConsolidatedRegionalData] = useState({});
    const [previousPeriodSaldo, setPreviousPeriodSaldo] = useState(null);
    const [previousStockKpiData, setPreviousStockKpiData] = useState(null);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    const [isHeroChartExpanded, setIsHeroChartExpanded] = useState(false);
    const heroChartScrollContainerRef = useRef(null);

    const logisticsService = useMemo(() => LogisticsService(), []);
    const estoqueService = useMemo(() => EstoqueService(), []);

    const fetchLastUpdateTime = async (tableName, dateColumn = 'created_at') => { try { const supabase = getSupabaseClient(); const { data, error } = await supabase .from(tableName) .select(dateColumn) .order(dateColumn, { ascending: false }) .limit(1) .single(); if (error && error.code !== 'PGRST116') { console.error(`Erro update ${tableName}:`, error); return null; } return data ? data[dateColumn] : null; } catch (err) { console.error(`Exceção update ${tableName}:`, err); return null; } };

    const fetchDashboardData = useCallback(async (startDate, endDate) => {
        const periodKey = `${startDate}_${endDate}`;
        const viewCache = cachedData?.dashboard?.[periodKey];

        if (viewCache && (Date.now() - viewCache.timestamp < CACHE_EXPIRY_MS)) {
            console.log(`[Dashboard Fetch] Cache HIT for period ${periodKey}`);
            const cached = viewCache.data;
            setLogisticsKpiData(cached.logisticsKpiData);
            setStockKpiData(cached.stockKpiData);
            setPreviousStockKpiData(cached.previousStockKpiData);
            setPreviousPeriodSaldo(cached.previousPeriodSaldo);
            setLogisticsTimeSeriesData(cached.logisticsTimeSeriesData);
            setDestructionReasonData(cached.destructionReasonData);
            setRegionalData(cached.regionalData);
            setConsolidatedRegionalData(cached.consolidatedRegionalData);
            setLastUpdateTimes(cached.lastUpdateTimes);
            setError(null);
            setLogisticsError(null);
            setStockError(null);
            setIsLoading(false);
            return;
        } else if (viewCache) {
            console.log(`[Dashboard Fetch] Cache STALE for period ${periodKey}`);
        } else {
             console.log(`[Dashboard Fetch] Cache MISS for period ${periodKey}`);
         }

        if (!startDate || !endDate) {
             console.warn("[Dashboard Fetch] Datas inválidas, aguardando período válido do contexto.");
             setIsLoading(false);
             return;
         }
        console.log(`[Dashboard Fetch] Buscando dados: ${startDate} a ${endDate}`);
        setIsLoading(true);
        setLogisticsError(null); setStockError(null); setError(null);
        const previousEndDate = getPreviousPeriodEndDate(startDate);
        const previousStartDate = getPreviousPeriodStartDate(startDate, endDate);
        try {
            const [
                 logisticsResult, stockResult, stockPreviousPeriodResult,
                 logisticsTimeSeriesResult, reasonsResult, regionalResult,
                 consolidatedRegionalResult, stockPreviousSaldoResult,
                 logisticsTime, stockTime
            ] = await Promise.allSettled([
                logisticsService.getAggregatedDailyKPIs(startDate, endDate),
                estoqueService.getAggregatedLocalStockKPIs(startDate, endDate),
                (previousStartDate && previousEndDate) ? estoqueService.getAggregatedLocalStockKPIs(previousStartDate, previousEndDate) : Promise.resolve({ data: null, error: null }),
                logisticsService.getDailyAggregatedTimeSeries(startDate, endDate),
                logisticsService.getReasonDailyTotals(startDate, endDate),
                logisticsService.getDailyRegionalStateTotals(startDate, endDate),
                logisticsService.getConsolidatedKpisForDateRange(startDate, endDate),
                previousEndDate ? estoqueService.getLocalStockBalance(previousEndDate) : Promise.resolve({ data: null, error: null }),
                fetchLastUpdateTime('logistics_daily_metrics', 'metric_date'),
                fetchLastUpdateTime('local_stock_entries', 'entry_date')
            ]);

            console.log("[Dashboard Fetch] Resultados Settled:", { logisticsResult, stockResult, stockPreviousPeriodResult, logisticsTimeSeriesResult, reasonsResult, regionalResult, consolidatedRegionalResult, stockPreviousSaldoResult, logisticsTime, stockTime });

            let currentErrors = [];
            const fetchedData = {
                logisticsKpiData: null,
                stockKpiData: null,
                previousStockKpiData: null,
                previousPeriodSaldo: null,
                logisticsTimeSeriesData: [],
                destructionReasonData: [],
                regionalData: {},
                consolidatedRegionalData: {},
                lastUpdateTimes: { logistics: null, stock: null }
            };

            if (logisticsResult.status === 'rejected' || logisticsResult.value?.error) { setLogisticsError(logisticsResult.reason?.message || logisticsResult.value?.error?.message || 'Erro Logística'); currentErrors.push("Logística"); } else { fetchedData.logisticsKpiData = { current: logisticsResult.value?.data, previous: null }; }
            if (stockResult.status === 'rejected' || stockResult.value?.error) { setStockError(stockResult.reason?.message || stockResult.value?.error?.message || 'Erro Estoque KPIs'); currentErrors.push("Estoque KPIs"); } else { fetchedData.stockKpiData = stockResult.value?.data; }
            if (stockPreviousPeriodResult.status === 'rejected' || stockPreviousPeriodResult.value?.error) { console.error("Erro KPIs estoque anterior:", stockPreviousPeriodResult.reason || stockPreviousPeriodResult.value?.error); currentErrors.push("Estoque Anterior"); } else { fetchedData.previousStockKpiData = stockPreviousPeriodResult.value?.data; }
            if (stockPreviousSaldoResult.status === 'rejected' || stockPreviousSaldoResult.value?.error) { console.error("Erro saldo anterior estoque:", stockPreviousSaldoResult.reason || stockPreviousSaldoResult.value?.error); } else { fetchedData.previousPeriodSaldo = stockPreviousSaldoResult.value?.data; }
            if (logisticsTimeSeriesResult.status === 'rejected' || logisticsTimeSeriesResult.value?.error) { console.error("Erro série temporal:", logisticsTimeSeriesResult.reason || logisticsTimeSeriesResult.value?.error); currentErrors.push("Série Temporal"); } else { fetchedData.logisticsTimeSeriesData = logisticsTimeSeriesResult.value?.data || []; }
            if (reasonsResult.status === 'rejected' || reasonsResult.value?.error) { console.error("Erro motivos destruição:", reasonsResult.reason || reasonsResult.value?.error); currentErrors.push("Motivos"); } else { fetchedData.destructionReasonData = reasonsResult.value?.data || []; }
            if (regionalResult.status === 'rejected' || regionalResult.value?.error) { console.error("Erro regionais diários:", regionalResult.reason || regionalResult.value?.error); currentErrors.push("Regionais"); } else { fetchedData.regionalData = regionalResult.value?.data || {}; }
            if (consolidatedRegionalResult.status === 'rejected' || consolidatedRegionalResult.value?.error || !consolidatedRegionalResult.value?.data) { console.error("Erro regionais consolidados:", consolidatedRegionalResult.reason || consolidatedRegionalResult.value?.error); } else { fetchedData.consolidatedRegionalData = consolidatedRegionalResult.value?.data; }
            fetchedData.lastUpdateTimes = { logistics: logisticsTime.status === 'fulfilled' ? logisticsTime.value : null, stock: stockTime.status === 'fulfilled' ? stockTime.value : null };

            setLogisticsKpiData(fetchedData.logisticsKpiData);
            setStockKpiData(fetchedData.stockKpiData);
            setPreviousStockKpiData(fetchedData.previousStockKpiData);
            setPreviousPeriodSaldo(fetchedData.previousPeriodSaldo);
            setLogisticsTimeSeriesData(fetchedData.logisticsTimeSeriesData);
            setDestructionReasonData(fetchedData.destructionReasonData);
            setRegionalData(fetchedData.regionalData);
            setConsolidatedRegionalData(fetchedData.consolidatedRegionalData);
            setLastUpdateTimes(fetchedData.lastUpdateTimes);

            if(currentErrors.length > 0) { setError(`Falha ao carregar: ${currentErrors.join(', ')}.`); }
            else {
                updateCache('dashboard', periodKey, fetchedData);
            }
        } catch (err) { reportError(err, 'fetchDashboardData'); setError(`Falha inesperada: ${err.message}`); setLogisticsKpiData(null); setStockKpiData(null); setPreviousStockKpiData(null); setPreviousPeriodSaldo(null); setLogisticsTimeSeriesData([]); setDestructionReasonData([]); setRegionalData({}); setConsolidatedRegionalData({}); }
        finally { setIsLoading(false); }
    }, [logisticsService, estoqueService, cachedData, updateCache]);

    useEffect(() => { fetchDashboardData(period.startDate, period.endDate); }, [period.startDate, period.endDate, fetchDashboardData]);
    useEffect(() => { const handleResize = () => setIsMobileView(window.innerWidth < 768); window.addEventListener('resize', handleResize); handleResize(); return () => window.removeEventListener('resize', handleResize); }, []);

    const toggleRegionExpansion = (region) => { setExpandedRegion(prev => prev === region ? null : region); };
    const toggleHeroChartExpansion = () => setIsHeroChartExpanded(prev => !prev);
    const SectionTitle = ({ icon, bgColorClass = 'bg-indigo-100', borderColorClass = 'border-indigo-200', textColorClass = 'text-indigo-900', iconColorClass = 'text-indigo-600', children, isExpanded, onToggle, collapsible = false }) => ( <div className={`flex items-center justify-between ${bgColorClass} border-b-2 ${borderColorClass} rounded-t-lg shadow-sm mb-0 p-3`}> <h3 className={`flex items-center text-base sm:text-lg font-semibold ${textColorClass}`}> {icon && <i className={`fas ${icon} mr-3 ${iconColorClass} fa-fw`}></i>} <span>{children}</span> </h3> {collapsible && ( <button onClick={onToggle} className={`text-xs font-medium px-2 py-1 rounded ${textColorClass} hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-current`} aria-expanded={isExpanded} aria-label={isExpanded ? 'Ver Menos KPIs' : 'Ver Todos KPIs'} > {isExpanded ? 'Ver Menos' : 'Ver Tudo'} </button> )} </div> );

    const heroChartData = useMemo(() => {
        const timeSeries = logisticsTimeSeriesData || [];
        if (timeSeries.length === 0) return { labels: [], datasets: [] };
        const labels = [...new Set(timeSeries.map(d => d.metric_date))].sort();
        let labelsToShow = labels;
        if (!isMobileView && !isHeroChartExpanded && labels.length > 7) {
            labelsToShow = labels.slice(-7);
        }
        const formattedLabelsToShow = labelsToShow.map(l => new Date(l + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

        const dataMap = labels.reduce((acc, date) => { acc[date] = { returned: 0, geral: 0 }; return acc; }, {});
        timeSeries.forEach(d => { if (dataMap[d.metric_date]) { if (d.sub_category === 'DEVOLUÇÃO') dataMap[d.metric_date].returned = d.value; if (d.sub_category === 'GERAL') dataMap[d.metric_date].geral = d.value; } });
        labels.forEach(date => { if (dataMap[date].geral === 0) { const relevantEntries = timeSeries.filter(d => d.metric_date === date && ['Entregue', 'Em Rota', 'DEVOLUÇÃO', 'Custodia'].includes(d.sub_category)); dataMap[date].geral = relevantEntries.reduce((sum, entry) => sum + (entry.value || 0), 0); } });

        const returnedDataToShow = labelsToShow.map(date => dataMap[date]?.returned || 0);
        const totalGeralDataToShow = labelsToShow.map(date => dataMap[date]?.geral || 0);

        const pointRadius = labels.length > 30 ? (isHeroChartExpanded ? 1 : 0) : 3;

        return { labels: formattedLabelsToShow, datasets: [
            { label: 'Total Geral', data: totalGeralDataToShow, yAxisID: 'y', type: 'line', borderColor: '#3b82f6', backgroundColor: '#3b82f633', tension: 0.2, fill: false, pointRadius: pointRadius, pointHoverRadius: 5, },
            { label: 'Devolvidos', data: returnedDataToShow, yAxisID: 'y', type: 'line', borderColor: '#ef4444', backgroundColor: '#ef444433', tension: 0.2, fill: false, pointRadius: pointRadius, pointHoverRadius: 5 }
        ] };
     }, [logisticsTimeSeriesData, isMobileView, isHeroChartExpanded]);

    const heroChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
            x: {
                ticks: {
                    autoSkip: !isHeroChartExpanded,
                    maxRotation: (isMobileView || isHeroChartExpanded) ? 60 : 0,
                    font: { size: 10 },
                    padding: 5
                }
            },
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Quantidade',
                    font: { size: 11 }
                },
                ticks: { font: { size: 10 } }
            }
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    font: { size: 11 },
                    usePointStyle: true,
                    pointStyleWidth: 8
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) { label += ': '; }
                        if (context.parsed.y !== null) {
                            label += formatNumber(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        }
    }), [formatNumber, isMobileView, isHeroChartExpanded]);

    const heroChartMinWidth = isHeroChartExpanded ? `${Math.max(600, (heroChartData?.labels?.length || 0) * (isMobileView ? 35 : 50))}px` : '100%';

    const reasonsChartData = useMemo(() => { const sortedReasons = [...destructionReasonData].sort((a, b) => b.count - a.count); return { labels: sortedReasons.map(r => r.reason), datasets: [{ label: 'Contagem', data: sortedReasons.map(r => r.count), backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#71717a'], borderColor: '#ffffff', borderWidth: 1, barThickness: 15, }] }; }, [destructionReasonData]);
    const reasonsChartOptions = useMemo(() => ({ indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } } }, y: { ticks: { autoSkip: false, font: { size: 10 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatNumber(ctx.raw)}` } } } }), [formatNumber]);

    const currentLogisticsKpis = logisticsKpiData?.current;
    const currentStockKpis = stockKpiData;
    const isSingleDayView = period.startDate === period.endDate;

    const calculatedTotalGeralLogistics = useMemo(() => { if (!currentLogisticsKpis) return 0; return (currentLogisticsKpis.delivered ?? 0) + (currentLogisticsKpis.returned ?? 0) + (currentLogisticsKpis.custody ?? 0) + (currentLogisticsKpis.inRoute ?? 0); }, [currentLogisticsKpis]);

    const renderKPISkeletons = (count = 5) => (
        <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
            {Array.from({ length: count }).map((_, index) => (
                <Box key={index} className="bg-white p-4 rounded-lg shadow-md border border-gray-100 flex flex-col justify-between min-h-[100px]">
                     <Skeleton variant="text" width="60%" height={20} sx={{ marginBottom: 1 }} />
                     <Skeleton variant="text" width="80%" height={36} sx={{ marginBottom: 1 }}/>
                     <Skeleton variant="text" width="40%" height={16} />
                 </Box>
             ))}
         </div>
    );

    const renderChartSkeleton = () => (
        <Skeleton variant="rectangular" width="100%" height={288} className="rounded-lg" />
    );

    const renderRegionalSkeletons = (count = 3) => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {Array.from({ length: count }).map((_, index) => (
                <Box key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm min-h-[80px]">
                    <Skeleton variant="text" width="40%" height={24} sx={{ marginBottom: 1 }} />
                    <Skeleton variant="text" width="80%" height={16} />
                    <Skeleton variant="text" width="60%" height={16} />
                </Box>
             ))}
         </div>
    );

    return (
        <div data-name="dashboard-container" className="space-y-6 relative">
             {isLoading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-40 rounded-lg">
                    <div className="text-center">
                         <LoadingSpinner message="Conteúdo sendo carregado, por favor aguarde..." />
                    </div>
                 </div>
            )}

             <div className={`transition-filter duration-300 ${isLoading ? 'blur-sm pointer-events-none' : ''}`}>

                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-xs sm:text-sm shadow-sm flex flex-wrap justify-between items-center gap-x-4 gap-y-1">
                     <span className='font-semibold'><i className="fas fa-info-circle mr-2"></i>Últimas Atualizações:</span>
                     {isLoading ? ( <Skeleton variant="text" width={200} /> ) : ( <span className='flex flex-wrap gap-x-3 gap-y-1'> <span>Logística: <strong className='text-blue-900'>{formatUpdateTime(lastUpdateTimes.logistics)}</strong></span> <span>Estoque: <strong className='text-blue-900'>{formatUpdateTime(lastUpdateTimes.stock)}</strong></span> </span> )}
                </div>

                <ErrorDisplay error={error ? { message: error } : null} onRetry={() => fetchDashboardData(period.startDate, period.endDate)} onDismiss={() => setError(null)} />
                {logisticsError && <ErrorDisplay error={{ message: `Erro Logística: ${logisticsError}` }} onRetry={() => fetchDashboardData(period.startDate, period.endDate)} onDismiss={() => setLogisticsError(null)} />}
                {stockError && <ErrorDisplay error={{ message: `Erro Estoque: ${stockError}` }} onRetry={() => fetchDashboardData(period.startDate, period.endDate)} onDismiss={() => setStockError(null)} />}

                <PeriodFilter />

                <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                         <h3 className="text-base font-semibold text-gray-700">Total Geral vs. Devolvidos ({isSingleDayView ? 'Dia' : 'Período'})</h3>
                         {logisticsTimeSeriesData.length > 0 && !isLoading && (
                             <button onClick={toggleHeroChartExpansion} className="btn btn-secondary btn-xs py-1 px-2">
                                 {isHeroChartExpanded ? 'Ver Resumo' : 'Ver Gráfico'}
                             </button>
                         )}
                    </div>
                    {isLoading ? (renderChartSkeleton()) : logisticsTimeSeriesData.length > 0 ? (
                        <>
                            {(!isHeroChartExpanded && isMobileView) ? (
                                <p className="text-center text-gray-500 py-10 italic flex-grow flex items-center justify-center">Gráfico disponível em tela maior ou expandido.</p>
                            ) : (
                                <div className="flex-grow relative h-[288px]">
                                    <div ref={heroChartScrollContainerRef} className={`absolute inset-0 ${isHeroChartExpanded ? 'overflow-x-auto' : 'overflow-x-hidden'}`}>
                                        <div style={{ minWidth: heroChartMinWidth, height: '100%' }} className="relative">
                                            <ChartComponent type="line" data={heroChartData} options={heroChartOptions} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                     ) : (<div className="text-center text-gray-500 py-10 flex-grow flex items-center justify-center">Nenhum dado de série temporal encontrado.</div>) }
                </div>


                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                     <div>
                         <SectionTitle icon="fa-truck-fast" bgColorClass='bg-blue-50' borderColorClass='border-blue-200' textColorClass='text-blue-900' iconColorClass='text-blue-600' isExpanded={isLogisticsExpanded} onToggle={() => setIsLogisticsExpanded(prev => !prev)} collapsible={true}>
                             Status Logístico ({isSingleDayView ? 'Dia' : 'Período'})
                         </SectionTitle>
                         {isLoading ? (renderKPISkeletons(isLogisticsExpanded ? 5 : 1)) : (
                             <>
                                 {!logisticsError && !currentLogisticsKpis && <div className="p-4 text-center text-gray-500 italic">Nenhum dado logístico para o período.</div>}
                                 {logisticsError && <div className="p-4 text-center text-red-600">Falha ao carregar dados logísticos.</div>}
                                 {currentLogisticsKpis && (
                                     <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
                                          <KPIPanel icon="fa-tasks text-gray-500" title="Total Geral" value={formatNumber(calculatedTotalGeralLogistics)} />
                                          <div className={`contents transition-opacity duration-500 ease-in-out ${isLogisticsExpanded ? 'opacity-100' : 'opacity-0'}`}>
                                              {isLogisticsExpanded && ( <>
                                                 <KPIPanel icon="fa-undo text-red-500" title="Devolvido" value={formatNumber(currentLogisticsKpis?.returned)} />
                                                 <KPIPanel icon="fa-check-circle text-green-500" title="Entregue" value={formatNumber(currentLogisticsKpis?.delivered)} />
                                                 <KPIPanel icon="fa-shipping-fast text-blue-500" title="Em Rota" value={formatNumber(currentLogisticsKpis?.inRoute)} />
                                                 <KPIPanel icon="fa-box-archive text-yellow-500" title="Custódia" value={formatNumber(currentLogisticsKpis?.custody)} />
                                              </> )}
                                          </div>
                                     </div>
                                 )}
                             </>
                         )}
                     </div>

                     <div>
                         <SectionTitle icon="fa-warehouse" bgColorClass='bg-teal-50' borderColorClass='border-teal-200' textColorClass='text-teal-900' iconColorClass='text-teal-600' isExpanded={isStockExpanded} onToggle={() => setIsStockExpanded(prev => !prev)} collapsible={true}>
                             Estoque Local (Resumo)
                         </SectionTitle>
                         {isLoading ? (renderKPISkeletons(isStockExpanded ? 4 : 1)) : (
                             <>
                                 {!stockError && !currentStockKpis && <div className="p-4 text-center text-gray-500 italic">Nenhum dado de estoque para o período.</div>}
                                 {stockError && <div className="p-4 text-center text-red-600">Falha ao carregar dados de estoque.</div>}
                                 {currentStockKpis && (
                                     <div className="kpi-grid grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 p-4">
                                         <KPIPanel icon="fa-boxes-stacked text-teal-500" title="Saldo Atual" value={formatNumber(currentStockKpis.saldoAtual)} comparison={renderComparison(currentStockKpis.saldoAtual, previousPeriodSaldo)} />
                                         {isStockExpanded && (
                                             <>
                                                 <KPIPanel icon="fa-arrow-down text-green-500" title="Entradas Totais" value={formatNumber(currentStockKpis.entradasTotal)} />
                                                 <KPIPanel icon="fa-arrow-up text-red-500" title="Saídas (Enviado)" value={formatNumber(currentStockKpis.saidasTotal)} />
                                                 <KPIPanel icon="fa-exchange-alt text-blue-500" title="Variação Líquida" value={formatNumber(currentStockKpis.entradasTotal - currentStockKpis.saidasTotal)} />
                                             </>
                                         )}
                                     </div>
                                 )}
                             </>
                         )}
                     </div>

                </div>

                <div className="bg-white rounded-lg shadow-md border border-gray-200 pt-0">
                    <SectionTitle icon="fa-map-location-dot">Resumo Operacional por Região (Diário)</SectionTitle>
                     {isLoading ? (renderRegionalSkeletons()) : (
                         <>
                             {logisticsError && <div className="p-4 text-center text-red-600">Falha ao carregar dados regionais.</div>}
                             {!logisticsError && Object.keys(regionalData).length === 0 && <div className="p-4 text-center text-gray-500 italic">Nenhum dado regional para o período.</div>}
                             {!logisticsError && Object.keys(regionalData).length > 0 && (
                                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                                     {Object.entries(regionalData).sort(([regionA], [regionB]) => regionA.localeCompare(regionB)).map(([region, regionData]) => { const regionAverageCost = 0; return ( <div key={region} className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow transition-shadow duration-200"> <div className="flex justify-between items-center cursor-pointer mb-2" onClick={() => toggleRegionExpansion(region)}> <h4 className="text-sm font-semibold text-gray-800">{region}</h4> <div className='flex items-center space-x-3 text-xs'> <span className="text-gray-600 hidden sm:inline" title={`Total Processado na Região ${region}`}> Proc: <span className="font-medium text-gray-800">{formatNumber(regionData.total)}</span> </span> <i className={`fas fa-chevron-down text-gray-500 transition-transform duration-200 ${expandedRegion === region ? 'rotate-180' : ''}`}></i> </div> </div> <div id={`states-${region}`} className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedRegion === region ? 'mt-2 pt-2 border-t border-gray-200' : 'max-h-0'}`} > <div className="overflow-x-auto max-h-52"> <table className="min-w-full divide-y divide-gray-100 text-xs"> <thead className="bg-gray-100 sticky top-0 z-10"> <tr> <th scope="col" className="px-2 py-2 text-left font-medium text-gray-600 uppercase tracking-wider">Estado</th> <th scope="col" className="px-2 py-2 text-right font-medium text-gray-600 uppercase tracking-wider" title="Processados">P</th> </tr> </thead> <tbody className="bg-white divide-y divide-gray-100"> {Object.entries(regionData.states || {}).sort(([stateA], [stateB]) => stateA.localeCompare(stateB)).map(([state, stateData]) => ( <tr key={state} className="odd:bg-gray-50 hover:bg-indigo-50 transition-colors duration-150"> <td className="px-2 py-2 whitespace-nowrap font-medium text-gray-800">{state}</td> <td className="px-2 py-2 whitespace-nowrap text-right text-gray-700">{formatNumber(stateData.total ?? stateData)}</td> </tr> ))} {Object.keys(regionData.states || {}).length === 0 && ( <tr><td colSpan={2} className="px-2 py-3 text-center text-gray-500 italic">Nenhum estado nesta região.</td></tr> )} </tbody> </table> </div> </div> </div> ); })}
                                 </div>
                             )}
                             {consolidatedRegionalData?.last_day_absolute && consolidatedRegionalData?.regional_totals && (
                                <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
                                    <h4 className='text-center font-semibold text-gray-600 mb-2 text-sm'>Consolidado Último Dia ({formatDate(consolidatedRegionalData.last_date_found || period.endDate)})</h4>
                                     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-center text-xs">
                                         {Object.entries(consolidatedRegionalData.regional_totals || {}) .sort(([regionA], [regionB]) => regionA.localeCompare(regionB)) .map(([region, total]) => ( <div key={region + '-consolidated'} className="p-2 bg-gray-100 rounded"> <div className="font-medium text-gray-800">{region}</div> <div className="text-lg font-bold">{formatNumber(total)}</div> </div> ))}
                                         {Object.keys(consolidatedRegionalData.regional_totals || {}).length === 0 && <div className="col-span-full text-gray-500 italic">Nenhum dado consolidado regional.</div>}
                                     </div>
                                </div>
                             )}
                         </>
                     )}
                </div>
                 <div className="flex justify-center space-x-4 pt-4">
                     <button onClick={() => window.location.hash = '/logistica'} className="btn btn-secondary btn-sm"> <i className="fas fa-truck mr-2"></i> Ver Detalhes Logística </button>
                     <button onClick={() => window.location.hash = '/estoque'} className="btn btn-secondary btn-sm"> <i className="fas fa-boxes-stacked mr-2"></i> Ver Detalhes Estoque </button>
                 </div>

            </div>
        </div>
    );
}