import React, { useState, useEffect, useMemo, useCallback, useRef, useContext } from 'react';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

import LoadingOverlay from '../components/LoadingOverlay';
import PeriodFilter from '../components/PeriodFilter';
import FileUploaderLogistics from '../components/FileUploaderLogistics';
import FileUploaderLogisticsDaily from '../components/FileUploaderLogisticsDaily';
import KPIPanel from '../components/KPIPanel';
import ChartComponent from '../components/ChartComponent';
import TruncatedTextWithPopover from '../components/TruncatedTextWithPopover';
import LogisticsService from '../utils/logisticsService';
import getSupabaseClient from '../utils/supabaseClient';
import ErrorDisplay from '../components/ErrorDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
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
const getPreviousPeriod = (startDateStr, endDateStr) => { try { const start = new Date(startDateStr + 'T00:00:00Z'); const end = new Date(endDateStr + 'T00:00:00Z'); if (isNaN(start.getTime()) || isNaN(end.getTime())) { return { previousStartDate: null, previousEndDate: null }; } const diff = end.getTime() - start.getTime(); if (diff < 0) return { previousStartDate: null, previousEndDate: null }; const prevEndDate = new Date(start.getTime() - 24 * 60 * 60 * 1000); const prevStartDate = new Date(prevEndDate.getTime() - diff); return { previousStartDate: prevStartDate.toISOString().split('T')[0], previousEndDate: prevEndDate.toISOString().split('T')[0] }; } catch (e) { return { previousStartDate: null, previousEndDate: null }; } };

const renderSimpleComparison = (currentValue, previousValue) => {
    const change = calculatePercentageChange(currentValue, previousValue);
    if (change === null) { return <span className="text-xs text-gray-400 italic">N/D</span>; }
    let iconClass = 'fa-solid fa-minus', textClass = 'text-gray-500';
    let changeText = formatPercent(change / 100, 1);
    if (change > 0.1) { iconClass = 'fa-solid fa-arrow-up'; textClass = 'text-green-600'; changeText = `+${changeText}`; }
    else if (change < -0.1) { iconClass = 'fa-solid fa-arrow-down'; textClass = 'text-red-600'; }
    return <span className={`text-xs ${textClass} inline-flex items-center gap-1 whitespace-nowrap`}><i className={iconClass}></i><span>{changeText}</span><span className="text-gray-400">(vs ant.)</span></span>;
};

const CACHE_EXPIRY_MS = 5 * 60 * 1000;

export default function LogisticaView({ onNavigate, user }) {
    const reportError = (error, context = 'LogisticaView') => console.error(`[${context}] Error:`, error?.message || error);
    const { period, cachedData, updateCache } = useContext(FilterContext);
    const logisticsService = useMemo(() => LogisticsService(), []);

    const [showConsolidatedUploader, setShowConsolidatedUploader] = useState(false);
    const [showDailyUploader, setShowDailyUploader] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [dataError, setDataError] = useState(null);
    const [dailyKpiData, setDailyKpiData] = useState(null);
    const [consolidatedKpiData, setConsolidatedKpiData] = useState(null);
    const [reasonDailyTotals, setReasonDailyTotals] = useState([]);
    const [timeSeriesData, setTimeSeriesData] = useState([]);
    const [dailyRegionalStateTotals, setDailyRegionalStateTotals] = useState({});
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    const [isTimeSeriesChartExpanded, setIsTimeSeriesChartExpanded] = useState(false);
    const [isReasonsChartExpanded, setIsReasonsChartExpanded] = useState(false);
    const [expandedRegion, setExpandedRegion] = useState(null);
    const timeSeriesChartScrollContainerRef = useRef(null);
    const reasonsChartScrollContainerRef = useRef(null);

     const fetchAllLogisticData = useCallback(async (startDate, endDate) => {
        const periodKey = `${startDate}_${endDate}`;
        const viewCache = cachedData?.logistica?.[periodKey];

        if (viewCache && (Date.now() - viewCache.timestamp < CACHE_EXPIRY_MS)) {
            console.log(`[LogisticaView Fetch] Cache HIT for period ${periodKey}`);
            const cached = viewCache.data;
            setDailyKpiData(cached.dailyKpiData);
            setConsolidatedKpiData(cached.consolidatedKpiData);
            setReasonDailyTotals(cached.reasonDailyTotals);
            setTimeSeriesData(cached.timeSeriesData);
            setDailyRegionalStateTotals(cached.dailyRegionalStateTotals);
            setDataError(null);
            setIsLoading(false);
            return;
        } else if (viewCache) {
            console.log(`[LogisticaView Fetch] Cache STALE for period ${periodKey}`);
        } else {
             console.log(`[LogisticaView Fetch] Cache MISS for period ${periodKey}`);
         }

        if (!startDate || !endDate) {
             console.warn("[LogisticaView Fetch] Datas inválidas, aguardando período válido do contexto.");
             setIsLoading(false);
             return;
         }
        console.log(`[LogisticaView fetchAll] Iniciando busca: ${startDate} a ${endDate}`);
        if (!logisticsService) { setIsLoading(false); setDataError("Erro interno ou datas inválidas."); return; }
        setIsLoading(true);
        setDataError(null);
        setDailyKpiData(null); setConsolidatedKpiData(null); setReasonDailyTotals([]); setTimeSeriesData([]); setDailyRegionalStateTotals({});
        const { previousStartDate, previousEndDate } = getPreviousPeriod(startDate, endDate);
        try {
            const [
                dailyKpiResult, previousDailyKpiResult, consolidatedKpiResult,
                reasonsResult, timeSeriesResult, dailyRegionalResult
            ] = await Promise.allSettled([
                logisticsService.getAggregatedDailyKPIs(startDate, endDate),
                (previousStartDate && previousEndDate) ? logisticsService.getAggregatedDailyKPIs(previousStartDate, previousEndDate) : Promise.resolve({ data: null, error: null }),
                logisticsService.getConsolidatedKpisForDateRange(startDate, endDate),
                logisticsService.getReasonDailyTotals(startDate, endDate),
                logisticsService.getDailyAggregatedTimeSeries(startDate, endDate),
                logisticsService.getDailyRegionalStateTotals(startDate, endDate)
            ]);
            console.log(`[LogisticaView fetchAll] Resultados Settled:`, { dailyKpiResult, previousDailyKpiResult, consolidatedKpiResult, reasonsResult, timeSeriesResult, dailyRegionalResult });

             const errors = [];
             const fetchedData = {
                 dailyKpiData: null,
                 consolidatedKpiData: null,
                 reasonDailyTotals: [],
                 timeSeriesData: [],
                 dailyRegionalStateTotals: {}
             };

             if (dailyKpiResult.status === 'rejected' || dailyKpiResult.value?.error) errors.push(`KPIs Diários Atuais: ${dailyKpiResult.reason?.message || dailyKpiResult.value?.error?.message || 'Erro'}`);
             if (previousDailyKpiResult.status === 'rejected' || previousDailyKpiResult.value?.error) errors.push(`KPIs Diários Anteriores: ${previousDailyKpiResult.reason?.message || previousDailyKpiResult.value?.error?.message || 'Erro'}`);
             if (consolidatedKpiResult.status === 'rejected' || consolidatedKpiResult.value?.error || !consolidatedKpiResult.value?.data) errors.push(`KPI Consolidado: ${consolidatedKpiResult.reason?.message || consolidatedKpiResult.value?.error?.message || 'Dados não encontrados'}`);
             if (reasonsResult.status === 'rejected' || reasonsResult.value?.error) errors.push(`Motivos: ${reasonsResult.reason?.message || reasonsResult.value?.error?.message || 'Erro'}`);
             if (timeSeriesResult.status === 'rejected' || timeSeriesResult.value?.error) errors.push(`Série Temporal: ${timeSeriesResult.reason?.message || timeSeriesResult.value?.error?.message || 'Erro'}`);
             if (dailyRegionalResult.status === 'rejected' || dailyRegionalResult.value?.error) errors.push(`Regionais Diários: ${dailyRegionalResult.reason?.message || dailyRegionalResult.value?.error?.message || 'Erro'}`);

             if (errors.length > 0) { throw new Error(errors.join('; ')); }

             fetchedData.dailyKpiData = {
                 current: dailyKpiResult.status === 'fulfilled' ? dailyKpiResult.value.data : null,
                 previous: previousDailyKpiResult.status === 'fulfilled' ? previousDailyKpiResult.value.data : null
             };
             fetchedData.dailyRegionalStateTotals = dailyRegionalResult.status === 'fulfilled' ? dailyRegionalResult.value.data || {} : {};
             fetchedData.consolidatedKpiData = consolidatedKpiResult.status === 'fulfilled' ? consolidatedKpiResult.value.data : null;
             fetchedData.reasonDailyTotals = reasonsResult.status === 'fulfilled' ? reasonsResult.value.data || [] : [];
             fetchedData.timeSeriesData = timeSeriesResult.status === 'fulfilled' ? timeSeriesResult.value.data || [] : [];

             setDailyKpiData(fetchedData.dailyKpiData);
             setConsolidatedKpiData(fetchedData.consolidatedKpiData);
             setReasonDailyTotals(fetchedData.reasonDailyTotals);
             setTimeSeriesData(fetchedData.timeSeriesData);
             setDailyRegionalStateTotals(fetchedData.dailyRegionalStateTotals);

             updateCache('logistica', periodKey, fetchedData);


        } catch (err) { reportError(err, 'fetchAllLogisticData'); setDataError(`Falha ao carregar dados: ${err.message}`); setDailyKpiData(null); setConsolidatedKpiData(null); setReasonDailyTotals([]); setTimeSeriesData([]); setDailyRegionalStateTotals({}); }
        finally { setIsLoading(false); console.log(`[LogisticaView fetchAll] Busca finalizada.`); }
    }, [logisticsService, cachedData, updateCache]);

    useEffect(() => { console.log("[LogisticaView useEffect Update]", period); fetchAllLogisticData(period.startDate, period.endDate).catch(err => reportError(err, "useEffectUpdate[fetchAllLogisticData]")); }, [period.startDate, period.endDate, fetchAllLogisticData]);
    useEffect(() => { const handleResize = () => setIsMobileView(window.innerWidth < 768); window.addEventListener('resize', handleResize); handleResize(); return () => window.removeEventListener('resize', handleResize); }, []);
    useEffect(() => { const checkOverflow = (container) => container ? container.scrollWidth > container.clientWidth + 5 : false; const consContainer = timeSeriesChartScrollContainerRef.current; const reasonsContainer = reasonsChartScrollContainerRef.current; const handleResize = () => { checkOverflow(consContainer); checkOverflow(reasonsContainer); }; window.addEventListener('resize', handleResize); checkOverflow(consContainer); checkOverflow(reasonsContainer); return () => window.removeEventListener('resize', handleResize); }, [isTimeSeriesChartExpanded, isReasonsChartExpanded, timeSeriesData, reasonDailyTotals]);

    const handleConsolidatedUploadSuccess = async (processedData) => { setDataError(null); setShowConsolidatedUploader(false); reportError("handleConsolidatedUploadSuccess: Lógica de pós-upload aqui.", "LogisticaView"); console.log("Dados CONSOLIDADOS processados recebidos:", processedData); await fetchAllLogisticData(period.startDate, period.endDate); };
    const handleDailyUploadSuccess = async (processedData) => { setDataError(null); setShowDailyUploader(false); reportError("handleDailyUploadSuccess: Lógica de pós-upload aqui.", "LogisticaView"); console.log("Dados DIÁRIOS processados recebidos:", processedData); await fetchAllLogisticData(period.startDate, period.endDate); };

    const totalGeralDiarioAtual = useMemo(() => {
        const currentKpis = dailyKpiData?.current;
        if (!currentKpis) return 0;
        return (currentKpis.delivered ?? 0) + (currentKpis.returned ?? 0) + (currentKpis.custody ?? 0) + (currentKpis.inRoute ?? 0);
    }, [dailyKpiData]);

    const totalGeralDiarioAnterior = useMemo(() => {
        const previousKpis = dailyKpiData?.previous;
        if (!previousKpis) return 0;
        return (previousKpis.delivered ?? 0) + (previousKpis.returned ?? 0) + (previousKpis.custody ?? 0) + (previousKpis.inRoute ?? 0);
    }, [dailyKpiData]);

    const renderFullComparison = useCallback((kpiKey, currentDailyAggregate, previousDailyAggregate, consolidatedData) => {
        const currentVal = currentDailyAggregate?.[kpiKey];
        const previousVal = previousDailyAggregate?.[kpiKey];
        const consolidatedVal = consolidatedData?.last_day_absolute?.[kpiKey];
        const consolidatedDate = consolidatedData?.last_date_found;
        const currentTotalGeralForPercent = totalGeralDiarioAtual;
        let percentageOfTotal = null;
        if (kpiKey !== 'geral' && currentTotalGeralForPercent > 0 && currentVal !== null && currentVal !== undefined) {
            percentageOfTotal = (currentVal / currentTotalGeralForPercent);
        }
        const popComparison = renderSimpleComparison(currentVal, previousVal);
        return (
            <div className='mt-1 flex flex-col text-xs'>
                {!isMobileView && consolidatedVal !== null && consolidatedVal !== undefined && ( <span className='text-gray-500' title={`Valor consolidado em ${formatDate(consolidatedDate)}`}> (Consolidado: {formatNumber(consolidatedVal)}) </span> )}
                 <div className='flex flex-wrap items-center gap-x-2'> {percentageOfTotal !== null && ( <span className='text-gray-600'>({formatPercent(percentageOfTotal, 1)})</span> )} {percentageOfTotal !== null && popComparison && ( <span className='text-gray-400'>|</span> )} {popComparison} </div>
            </div>
        );
    }, [isMobileView, totalGeralDiarioAtual, formatNumber, formatPercent]);

    const timeSeriesChartData = useMemo(() => { const timeSeries = timeSeriesData || []; if (timeSeries.length === 0) return { labels: [], datasets: [] }; const labels = [...new Set(timeSeries.map(d => d.metric_date))].sort(); let labelsToShow = labels; if (!isMobileView && !isTimeSeriesChartExpanded && labels.length > 3) { labelsToShow = labels.slice(-3); } const formattedLabelsToShow = labelsToShow.map(l => formatDate(l)); const categories = ['Entregue', 'Em Rota', 'DEVOLUÇÃO', 'Custodia']; const colors = { 'Entregue': '#10b981', 'Em Rota': '#3b82f6', 'DEVOLUÇÃO': '#ef4444', 'Custodia': '#f59e0b' }; const datasets = categories.map(cat => { const fullDataPoints = labels.map(label => { const point = timeSeries.find(d => d.metric_date === label && (d.sub_category === cat || (cat === 'DEVOLUÇÃO' && ['DEVOLUCAO', 'DEVOLUÇÃO', 'DEVOLUÃ‡ÃƒO'].includes(d.sub_category))) ); return point ? point.value : null; }); let dataPointsToShow = fullDataPoints; if (!isMobileView && !isTimeSeriesChartExpanded && labels.length > 3) { dataPointsToShow = fullDataPoints.slice(-3); } const pointRadius = labels.length > 30 ? (isTimeSeriesChartExpanded ? 1: 0) : 3; return { label: cat, data: dataPointsToShow, borderColor: colors[cat], backgroundColor: `${colors[cat]}33`, tension: 0.1, yAxisID: 'y', fill: false, pointRadius: pointRadius, pointHoverRadius: 5, spanGaps: true, }; }); return { labels: formattedLabelsToShow, datasets }; }, [timeSeriesData, isTimeSeriesChartExpanded, isMobileView]);
    const returnReasonsChartData = useMemo(() => { if (!reasonDailyTotals || reasonDailyTotals.length === 0) return { labels: [], datasets: [] }; const reasonColors = ['#3b82f6', '#ef4444', '#f97316', '#eab308', '#10b981', '#14b8a6', '#6366f1', '#a855f7', '#ec4899', '#64748b', '#f43f5e', '#84cc16']; const dataToShow = isReasonsChartExpanded ? reasonDailyTotals : reasonDailyTotals.slice(0, isMobileView ? 5 : 7); return { labels: dataToShow.map(r => r.reason), datasets: [{ label: 'Total Diário/Período', data: dataToShow.map(r => r.count), backgroundColor: dataToShow.map((_, index) => reasonColors[index % reasonColors.length]) }] }; }, [reasonDailyTotals, isMobileView, isReasonsChartExpanded]);
    const lineChartOptions = useMemo(() => ({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { ticks: { autoSkip: !isTimeSeriesChartExpanded, maxRotation: (isMobileView || isTimeSeriesChartExpanded) ? 60 : 0, font: { size: 10 }, padding: 5 } }, y: { beginAtZero: true, title: { display: true, text: 'Quantidade (Diária Agregada)', font: { size: 11 } }, ticks: { font: { size: 10 }} } }, plugins: { legend: { position: 'bottom', labels: { font: {size: 11}, usePointStyle: true, pointStyleWidth: 8 } } } }), [isMobileView, isTimeSeriesChartExpanded]);
    const barChartOptions = useMemo(() => ({ responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { font: { size: 10 }}}, y: { ticks: { autoSkip: false, font: { size: 10 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `Total Diário/Período: ${formatNumber(ctx.raw)}` } } } }), [formatNumber]);
    const calculateBarChartHeight = (itemCount) => Math.max(300, itemCount * 28 + 100);
    const reasonsChartHeight = isReasonsChartExpanded ? calculateBarChartHeight(reasonDailyTotals.length) : 400;
    const timeSeriesChartMinWidth = (!isMobileView && !isTimeSeriesChartExpanded && timeSeriesChartData.labels.length > 0) ? '100%' : `${Math.max(600, (timeSeriesData?.length || 0) * (isMobileView ? 35 : 50))}px`;
    const toggleTimeSeriesChartExpansion = () => setIsTimeSeriesChartExpanded(prev => !prev);
    const toggleReasonsChartExpansion = () => setIsReasonsChartExpanded(prev => !prev);
    const toggleRegionExpansion = (region) => setExpandedRegion(prev => prev === region ? null : region);

    const renderNoDataMessage = (message) => ( <div className="flex items-center justify-center h-full text-center py-12 text-gray-500"> <div><i className="fas fa-info-circle text-4xl mb-4"></i> <p>{message}</p></div> </div> );
    const renderLoading = (message) => ( <div className="flex items-center justify-center h-full text-center py-12 text-gray-500"> <div><i className="fas fa-spinner fa-spin text-4xl mb-4"></i> <p>{message}</p></div> </div> );

    const canUpload = user && user.role !== 'guest';
    const currentDailyKpis = dailyKpiData?.current;
    const previousDailyKpis = dailyKpiData?.previous;
    const hasDailyKpis = !!currentDailyKpis && !isLoading && !dataError;
    const initialReasonsLimit = isMobileView ? 5 : 7;
    const showReasonsExpandButton = reasonDailyTotals.length > initialReasonsLimit;

    const consolidatedRegionalTotals = useMemo(() => { if (!consolidatedKpiData?.regional_totals) return {}; return consolidatedKpiData.regional_totals; }, [consolidatedKpiData]);

    const renderKPISkeletons = (count = 5) => (
        <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 my-6">
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
        <Skeleton variant="rectangular" width="100%" height={350} className="rounded-lg" />
    );

    const renderRegionalSkeletons = (count = 3) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, index) => (
                <Box key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 min-h-[100px]">
                    <Skeleton variant="text" width="50%" height={24} sx={{ marginBottom: 1 }} />
                    <Skeleton variant="text" width="90%" height={16} />
                    <Skeleton variant="text" width="70%" height={16} />
                </Box>
             ))}
         </div>
    );

    return (
        <div className="min-h-screen relative">
             {isLoading && (
                 <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-40 rounded-lg">
                    <div className="text-center">
                        <LoadingSpinner message="Conteúdo sendo carregado, por favor aguarde..." />
                    </div>
                 </div>
             )}
             <main className={`p-4 lg:p-6 transition-filter duration-300 ${isLoading ? 'blur-sm pointer-events-none' : ''}`}>
                 <ErrorDisplay error={dataError ? { message: `Erro Geral: ${dataError}` } : null} onRetry={() => fetchAllLogisticData(period.startDate, period.endDate)} onDismiss={() => setDataError(null)} />
                 <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4 lg:mb-0">Relatórios de Logística</h2>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                         {canUpload && ( <button onClick={() => setShowConsolidatedUploader(prev => !prev)} className={`btn ${showConsolidatedUploader ? 'btn-secondary' : 'btn-primary'} btn-icon w-full sm:w-auto`}><i className={`fas ${showConsolidatedUploader ? 'fa-times' : 'fa-upload'}`}></i> <span>{showConsolidatedUploader ? 'Fechar Consolidado' : 'Carregar Consolidado'}</span> </button> )}
                         {canUpload && ( <button onClick={() => setShowDailyUploader(prev => !prev)} className={`btn ${showDailyUploader ? 'btn-secondary' : 'btn-primary'} btn-icon w-full sm:w-auto`}><i className={`fas ${showDailyUploader ? 'fa-times' : 'fa-calendar-day'}`}></i> <span>{showDailyUploader ? 'Fechar Diário' : 'Carregar Diário'}</span> </button> )}
                    </div>
                </div>
                 {showConsolidatedUploader && canUpload && ( <div className="my-6"> <FileUploaderLogistics onFileUpload={handleConsolidatedUploadSuccess} user={user} onClose={() => setShowConsolidatedUploader(false)} /> </div> )}
                 {showDailyUploader && canUpload && ( <div className="my-6"> <FileUploaderLogisticsDaily onFileUpload={handleDailyUploadSuccess} user={user} onClose={() => setShowDailyUploader(false)} /> </div> )}
                 <PeriodFilter />

                {isLoading ? renderKPISkeletons() : (
                    <>
                        {!hasDailyKpis && !dataError && renderNoDataMessage("Nenhum dado de sumário encontrado para o período.")}
                        {hasDailyKpis && (
                            <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 my-6">
                                 <KPIPanel title="Entregue (Diário/Per.)" value={formatNumber(currentDailyKpis.delivered)} comparison={renderFullComparison('delivered', currentDailyKpis, previousDailyKpis, consolidatedKpiData)}/>
                                 <KPIPanel title="Devolvido (Diário/Per.)" value={formatNumber(currentDailyKpis.returned)} comparison={renderFullComparison('returned', currentDailyKpis, previousDailyKpis, consolidatedKpiData)}/>
                                 <KPIPanel title="Custódia (Diário/Per.)" value={formatNumber(currentDailyKpis.custody)} comparison={renderFullComparison('custody', currentDailyKpis, previousDailyKpis, consolidatedKpiData)} />
                                 <KPIPanel title="Em Rota (Diário/Per.)" value={formatNumber(currentDailyKpis.inRoute)} comparison={renderFullComparison('inRoute', currentDailyKpis, previousDailyKpis, consolidatedKpiData)} />
                                 <KPIPanel title="Total Geral (Diário/Per.)" value={formatNumber(totalGeralDiarioAtual)} comparison={renderFullComparison('geral', currentDailyKpis, previousDailyKpis, consolidatedKpiData)} />
                            </div>
                        )}
                    </>
                )}

                 {isLoading ? (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                         {renderChartSkeleton()}
                         {renderChartSkeleton()}
                     </div>
                 ) : (
                    <>
                         {!dataError && (timeSeriesData.length > 0 || reasonDailyTotals.length > 0) && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                <div className="bg-white p-4 rounded-lg shadow-md flex flex-col min-h-[400px]">
                                    <div className="flex justify-between items-center mb-4"> <h3 className="text-base font-semibold text-gray-700">Tendência Diária Agregada</h3> {timeSeriesData.length > 0 && ( <button onClick={toggleTimeSeriesChartExpansion} className="btn btn-secondary btn-xs py-1 px-2">{isTimeSeriesChartExpanded ? 'Ver Resumo' : 'Ver Gráfico'}</button> )} </div>
                                     {(!isTimeSeriesChartExpanded && isMobileView && timeSeriesData.length > 0) ? ( <p className="text-center text-gray-500 py-10 italic">Gráfico disponível em tela maior ou expandido.</p> ) : ( <div className="flex-grow relative h-[350px]"> <div ref={timeSeriesChartScrollContainerRef} className={`absolute inset-0 ${isTimeSeriesChartExpanded ? 'overflow-x-auto' : 'overflow-x-hidden'}`}> <div style={{ minWidth: timeSeriesChartMinWidth, height: '100%' }} className="relative"> {timeSeriesData.length > 0 ? <ChartComponent type="line" data={timeSeriesChartData} options={lineChartOptions} /> : renderNoDataMessage("Sem dados para gráfico de tendência.")} </div> </div> </div> )}
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow-md flex flex-col min-h-[400px]">
                                     <div className="flex justify-between items-center mb-4"> <h3 className="text-base font-semibold text-gray-700">Motivos Devolução (Diário/Período)</h3> {showReasonsExpandButton && ( <button onClick={toggleReasonsChartExpansion} className="btn btn-secondary btn-xs py-1 px-2">{isReasonsChartExpanded ? (isMobileView ? 'Ver Resumo' : 'Ver Menos') : `Ver ${isMobileView ? 'Gráfico' : `Todos (${reasonDailyTotals.length})`}`}</button> )} </div>
                                      {(!isReasonsChartExpanded && isMobileView && reasonDailyTotals.length > 0) ? ( <p className="text-center text-gray-500 py-10 italic">Gráfico disponível em tela maior ou expandido.</p> ) : ( <div className="flex-grow relative" style={{ height: `${reasonsChartHeight}px` }}> <div ref={reasonsChartScrollContainerRef} className={`absolute inset-0 ${isReasonsChartExpanded ? 'overflow-auto' : 'overflow-hidden'}`}> <div style={{ height: isReasonsChartExpanded ? `${calculateBarChartHeight(returnReasonsChartData.labels.length)}px` : '100%', width:'100%' }}> {reasonDailyTotals.length > 0 ? <ChartComponent type="bar" data={returnReasonsChartData} options={barChartOptions} /> : renderNoDataMessage("Sem dados de motivos.")} </div> </div> </div> )}
                                </div>
                            </div>
                         )}
                    </>
                 )}

                 {isLoading ? renderRegionalSkeletons() : (
                    <>
                         {!dataError && Object.keys(dailyRegionalStateTotals).length > 0 && (
                             <div className="mb-6">
                                 <h3 className="text-xl font-semibold text-gray-800 mb-4">Totais Diários por Região (Período)</h3>
                                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                     {Object.entries(dailyRegionalStateTotals).sort(([, a], [, b]) => b.total - a.total).map(([region, regionData]) => ( <div key={region} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"> <div className="flex justify-between items-center cursor-pointer mb-2" onClick={() => toggleRegionExpansion(region)} role="button" tabIndex={0} aria-expanded={expandedRegion === region} aria-controls={`states-${region}`}> <h4 className="text-base font-semibold text-gray-700">{region}</h4> <div className='flex items-center'> <span className="text-lg font-bold mr-2">{formatNumber(regionData.total)}</span> <i className={`fas fa-chevron-down transition-transform duration-200 ${expandedRegion === region ? 'rotate-180' : ''}`}></i> </div> </div> <div id={`states-${region}`} className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedRegion === region ? 'max-h-96 mt-3 pt-3 border-t border-gray-200' : 'max-h-0'}`} style={{ maxHeight: expandedRegion === region ? '24rem' : '0' }} > <div className="space-y-1 pl-2 overflow-y-auto max-h-80 pr-2"> {Object.entries(regionData.states).sort(([, a], [, b]) => b - a).map(([state, count]) => ( <div key={state} className="flex justify-between items-center text-sm pr-2 border-b border-gray-100 last:border-b-0 pb-1"> <TruncatedTextWithPopover className="text-gray-600" title={state}>{state}</TruncatedTextWithPopover> <span className="font-medium flex-shrink-0 ml-2">{formatNumber(count)}</span> </div> ))} {Object.keys(regionData.states).length === 0 && <p className="text-sm text-gray-500 italic">Nenhum estado.</p>} </div> </div> </div> ))}
                                 </div>
                             </div>
                         )}
                         {!dataError && Object.keys(dailyRegionalStateTotals).length === 0 && !isLoading && ( <div className="mb-6"> <h3 className="text-xl font-semibold text-gray-800 mb-4">Totais por Região</h3> {renderNoDataMessage("Nenhum dado regional.")} </div> )}
                    </>
                 )}
            </main>
        </div>
    );
}