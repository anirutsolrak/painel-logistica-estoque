import React, { useState, useEffect, useMemo, useCallback, useRef, useContext } from 'react';
import { Chart } from 'chart.js/auto';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

import LoadingOverlay from '../components/LoadingOverlay';
import PeriodFilter from '../components/PeriodFilter';
import FileUploaderEstoque from '../components/FileUploaderEstoque';
import KPIPanel from '../components/KPIPanel';
import ChartComponent from '../components/ChartComponent';
import ErrorDisplay from '../components/ErrorDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import TruncatedTextWithPopover from '../components/TruncatedTextWithPopover';

import EstoqueService from '../utils/EstoqueService';
import getSupabaseClient from '../utils/supabaseClient';
import { FilterContext } from '../contexto/FilterContext';

const formatDate = (dateString) => { if (!dateString) return ''; try { const date = new Date(dateString); if (isNaN(date.getTime())) return dateString; return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); } catch (e) { return dateString; } };
const formatDateTime = (timestamp) => { if (!timestamp) return 'N/A'; try { const date = new Date(timestamp); return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return 'Data inválida'; } };
const formatNumber = (value, decimals = 0, isCurrency = false) => { if (value === null || value === undefined) { return decimals === 0 ? 'N/D' : (isCurrency ? 'R$ --,--' : 'N/D'); } const num = Number(value); if (isNaN(num)) { return decimals === 0 ? 'Invál.' : (isCurrency ? 'R$ Invál.' : 'Invál.'); } if (isCurrency && decimals > 0) { let fV; const aN = Math.abs(num); if (aN >= 1e6) { fV = (num / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M'; } else if (aN >= 1e3) { fV = (num / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' K'; } else { fV = num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); } return `R$ ${fV}`; } const absNum = Math.abs(num); if (decimals === 0 && absNum >= 1e6) { return (num / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M'; } if (decimals === 0 && absNum >= 1e3) { return (num / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' K'; } return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); };
const formatPercent = (value, decimals = 1) => { if (value === null || value === undefined || isNaN(Number(value))) return '-'; const num = Number(value); return num.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals }); };
const calculatePercentageChange = (current, previous) => { if (previous === null || previous === undefined || previous === 0 || current === null || current === undefined) { return null; } return ((current - previous) / Math.abs(previous)) * 100; };
const getPreviousPeriodEndDate = (startDateStr) => { try { const start = new Date(startDateStr + 'T00:00:00Z'); if (isNaN(start.getTime())) return null; const prevEndDate = new Date(start.getTime() - 24 * 60 * 60 * 1000); return prevEndDate.toISOString().split('T')[0]; } catch (e) { return null; } };
const getPreviousPeriodStartDate = (startDateStr, endDateStr) => { try { const start = new Date(startDateStr + 'T00:00:00Z'); const end = new Date(endDateStr + 'T00:00:00Z'); if (isNaN(start.getTime()) || isNaN(end.getTime())) return null; const diff = end.getTime() - start.getTime(); if (diff < 0) return null; const prevEndDate = new Date(start.getTime() - 24 * 60 * 60 * 1000); const prevStartDate = new Date(prevEndDate.getTime() - diff); return prevStartDate.toISOString().split('T')[0]; } catch(e) { return null; }};

const renderSimpleComparison = (currentValue, previousValue) => { const change = calculatePercentageChange(currentValue, previousValue); if (change === null) { return <span className="text-xs text-gray-400 italic">N/D</span>; } let iconClass = 'fa-solid fa-minus', textClass = 'text-gray-500'; let changeText = formatPercent(change / 100, 1); if (change > 0.1) { iconClass = 'fa-solid fa-arrow-up'; textClass = 'text-green-600'; changeText = `+${changeText}`; } else if (change < -0.1) { iconClass = 'fa-solid fa-arrow-down'; textClass = 'text-red-600'; } return <span className={`text-xs ${textClass} inline-flex items-center gap-1 whitespace-nowrap`}><i className={iconClass}></i><span>{changeText}</span><span className="text-gray-400">(vs ant.)</span></span>; };

const ufToRegionMap = { 'AC': 'NORTE', 'AP': 'NORTE', 'AM': 'NORTE', 'PA': 'NORTE', 'RO': 'NORTE', 'RR': 'NORTE', 'TO': 'NORTE', 'AL': 'NORDESTE', 'BA': 'NORDESTE', 'CE': 'NORDESTE', 'MA': 'NORDESTE', 'PB': 'NORDESTE', 'PE': 'NORDESTE', 'PI': 'NORDESTE', 'RN': 'NORDESTE', 'SE': 'NORDESTE', 'DF': 'CENTRO OESTE', 'GO': 'CENTRO OESTE', 'MT': 'CENTRO OESTE', 'MS': 'CENTRO OESTE', 'ES': 'SUDESTE', 'MG': 'SUDESTE', 'RJ': 'SUDESTE', 'SP': 'SUDESTE', 'PR': 'SUL', 'RS': 'SUL', 'SC': 'SUL' };

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes cache expiry

export default function EstoqueView({ user, onNavigate }) {
    const reportError = (error, context = 'EstoqueView') => console.error(`[${context}] Error:`, error?.message || error);
    const { period, cachedData, updateCache } = useContext(FilterContext); // Use cache functions
    const estoqueService = useMemo(() => EstoqueService(), []);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showUploader, setShowUploader] = useState(false);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    const stockChartRef = useRef(null);
    const [expandedResendRegion, setExpandedResendRegion] = useState(null);
    const [isStockChartExpanded, setIsStockChartExpanded] = useState(false);
    const stockChartScrollContainerRef = useRef(null);

    const [currentKpiData, setCurrentKpiData] = useState(null);
    const [previousPeriodEndSaldo, setPreviousPeriodEndSaldo] = useState(null);
    const [timeSeriesData, setTimeSeriesData] = useState([]);
    const [lastStockUpdate, setLastStockUpdate] = useState(null);
    const [resendUfData, setResendUfData] = useState({});
    const [resendGroupData, setResendGroupData] = useState([]);
    const [ufAverageCosts, setUfAverageCosts] = useState({});

    const fetchLastStockUpdateTime = async () => { try { const supabase = getSupabaseClient(); const { data, error } = await supabase .from('local_stock_entries') .select('created_at') .order('created_at', { ascending: false }) .limit(1) .maybeSingle(); if (error) throw error; return data?.created_at ?? null; } catch (err) { reportError(err, "fetchLastStockUpdateTime"); return null; } };

    const fetchLocalStockData = useCallback(async (startDate, endDate) => {
        const periodKey = `${startDate}_${endDate}`;
        const viewCache = cachedData?.estoque?.[periodKey];

        if (viewCache && (Date.now() - viewCache.timestamp < CACHE_EXPIRY_MS)) {
            console.log(`[EstoqueView Fetch] Cache HIT for period ${periodKey}`);
            const cached = viewCache.data;
            setCurrentKpiData(cached.currentKpiData);
            setPreviousPeriodEndSaldo(cached.previousPeriodEndSaldo);
            setTimeSeriesData(cached.timeSeriesData);
            setLastStockUpdate(cached.lastStockUpdate);
            setResendUfData(cached.resendUfData);
            setResendGroupData(cached.resendGroupData);
            setUfAverageCosts(cached.ufAverageCosts);
            setError(null);
            setIsLoading(false);
            return; // Skip fetching
        } else if (viewCache) {
            console.log(`[EstoqueView Fetch] Cache STALE for period ${periodKey}`);
        } else {
             console.log(`[EstoqueView Fetch] Cache MISS for period ${periodKey}`);
        }

        if (!startDate || !endDate) {
             console.warn("[EstoqueView Fetch] Datas inválidas, aguardando período válido do contexto.");
             setIsLoading(false);
             return;
         }
        console.log(`[EstoqueView Fetch] Buscando dados: ${startDate} a ${endDate}`);
        if (!estoqueService) { setError("Serviço de estoque não inicializado."); setIsLoading(false); return; }
        setIsLoading(true);
        setError(null);
        setCurrentKpiData(null); setPreviousPeriodEndSaldo(null); setTimeSeriesData([]); setLastStockUpdate(null); setResendUfData({}); setResendGroupData([]); setUfAverageCosts({});

        const currentPeriodPrevDay = getPreviousPeriodEndDate(startDate);
        const previousStartDate = getPreviousPeriodStartDate(startDate, endDate);
        const previousPeriodPrevDay = previousStartDate ? getPreviousPeriodEndDate(previousStartDate) : null;

        try {
            const results = await Promise.allSettled([
                estoqueService.getAggregatedLocalStockKPIs(startDate, endDate),
                currentPeriodPrevDay ? estoqueService.getLocalStockBalance(currentPeriodPrevDay) : Promise.resolve({ data: null, error: null }),
                previousPeriodPrevDay ? estoqueService.getLocalStockBalance(previousPeriodPrevDay) : Promise.resolve({ data: null, error: null }),
                (previousStartDate && previousPeriodPrevDay) ? estoqueService.getAggregatedLocalStockKPIs(previousStartDate, getPreviousPeriodEndDate(startDate)) : Promise.resolve({ data: null, error: null }),
                estoqueService.getLocalStockTimeSeries(startDate, endDate),
                fetchLastStockUpdateTime(),
                estoqueService.getResendStatsByUF(startDate, endDate),
                estoqueService.getResendGroupCounts(startDate, endDate),
                estoqueService.getAllUfAverageCosts()
            ]);

            console.log("[EstoqueView Fetch] Resultados Settled:", results);

            let errors = [];
            const fetchedData = {
                currentKpiData: null,
                previousPeriodEndSaldo: null,
                timeSeriesData: [],
                lastStockUpdate: null,
                resendUfData: {},
                resendGroupData: [],
                ufAverageCosts: {}
            };
            let previousStartSaldo = null;
            let previousKpiData = null;

            if (results[0].status === 'fulfilled' && !results[0].value.error) { fetchedData.currentKpiData = results[0].value.data; } else { errors.push(`KPIs Atuais: ${results[0].reason?.message || results[0].value?.error?.message}`); }
            if (results[1].status === 'fulfilled' && !results[1].value.error) { /* currentStartSaldo = results[1].value.data; */ } else { if(results[1].status !== 'fulfilled' || results[1].value.error) errors.push(`Saldo Inicial Atual: ${results[1].reason?.message || results[1].value?.error?.message}`); }
            if (results[2].status === 'fulfilled' && !results[2].value.error) { previousStartSaldo = results[2].value.data; } else { if(results[2].status !== 'fulfilled' || results[2].value.error) errors.push(`Saldo Inicial Anterior: ${results[2].reason?.message || results[2].value?.error?.message}`); }
            if (results[3].status === 'fulfilled' && !results[3].value.error) { previousKpiData = results[3].value.data; } else { if(results[3].status !== 'fulfilled' || results[3].value.error) errors.push(`KPIs Anteriores: ${results[3].reason?.message || results[3].value?.error?.message}`); }
            if (results[4].status === 'fulfilled' && !results[4].value.error) { fetchedData.timeSeriesData = results[4].value.data || []; } else { errors.push(`Série Temp.: ${results[4].reason?.message || results[4].value?.error?.message}`); }
            if (results[5].status === 'fulfilled') { fetchedData.lastStockUpdate = results[5].value; } else { errors.push(`Últ Update: ${results[5].reason?.message}`); }
            if (results[6].status === 'fulfilled' && !results[6].value.error) { fetchedData.resendUfData = results[6].value.data || {}; } else { errors.push(`Reenvios UF: ${results[6].reason?.message || results[6].value?.error?.message}`); }
            if (results[7].status === 'fulfilled' && !results[7].value.error) { fetchedData.resendGroupData = results[7].value.data || []; } else { errors.push(`Reenvios Grp: ${results[7].reason?.message || results[7].value?.error?.message}`); }
            if (results[8].status === 'fulfilled' && !results[8].value.error) { fetchedData.ufAverageCosts = results[8].value.data || {}; } else { errors.push(`Custos UF: ${results[8].reason?.message || results[8].value?.error?.message}`); }

            if (errors.length > 0) { throw new Error(errors.join('; ')); }

            fetchedData.previousPeriodEndSaldo = previousKpiData ? (previousStartSaldo ?? 0) + (previousKpiData.entradasTotal ?? 0) - ((previousKpiData.saidasTotal ?? 0) + (previousKpiData.destruido ?? 0)) : null;

            setCurrentKpiData(fetchedData.currentKpiData);
            setPreviousPeriodEndSaldo(fetchedData.previousPeriodEndSaldo);
            setTimeSeriesData(fetchedData.timeSeriesData);
            setLastStockUpdate(fetchedData.lastStockUpdate);
            setResendUfData(fetchedData.resendUfData);
            setResendGroupData(fetchedData.resendGroupData);
            setUfAverageCosts(fetchedData.ufAverageCosts);

            // Update cache on successful fetch
            updateCache('estoque', periodKey, fetchedData);

        } catch (err) { reportError(err, 'fetchLocalStockData'); setError(`Falha ao carregar dados: ${err.message}`); setCurrentKpiData(null); setPreviousPeriodEndSaldo(null); setTimeSeriesData([]); setLastStockUpdate(null); setResendUfData({}); setResendGroupData([]); setUfAverageCosts({}); }
        finally { setIsLoading(false); }
    }, [estoqueService, cachedData, updateCache]); // Add cache dependencies

    useEffect(() => { fetchLocalStockData(period.startDate, period.endDate); }, [period.startDate, period.endDate, fetchLocalStockData]);
    useEffect(() => { const handleResize = () => setIsMobileView(window.innerWidth < 768); window.addEventListener('resize', handleResize); handleResize(); return () => window.removeEventListener('resize', handleResize); }, []);

    const handleEstoqueUploadSuccess = async (processedMetrics) => { reportError("handleEstoqueUploadSuccess precisa ser adaptada.", "EstoqueView"); setShowUploader(false); await fetchLocalStockData(period.startDate, period.endDate); };
    const toggleResendRegionExpansion = (region) => { setExpandedResendRegion(prev => prev === region ? null : region); };
    const toggleStockChartExpansion = () => setIsStockChartExpanded(prev => !prev);

     const currentPeriodEndingBalance = useMemo(() => {
         if (previousPeriodEndSaldo === null || currentKpiData === null) return null;
         const saldoInicial = previousPeriodEndSaldo ?? 0;
         const entradas = currentKpiData.entradasTotal ?? 0;
         const saidas = (currentKpiData.saidasTotal ?? 0) + (currentKpiData.destruido ?? 0);
         return saldoInicial + entradas - saidas;
     }, [previousPeriodEndSaldo, currentKpiData]);

    const displayedKPIs = useMemo(() => {
        if (!currentKpiData) return {};
        return {
             saldo: { title: "Saldo Final (Período)", value: currentPeriodEndingBalance, comparison: renderSimpleComparison(currentPeriodEndingBalance, previousPeriodEndSaldo) },
             entradasTotal: { title: "Entradas (Total)", value: currentKpiData.entradasTotal },
             saidasTotal: { title: "Saídas (Enviado)", value: currentKpiData.saidasTotal },
             destruido: { title: "Destruído", value: currentKpiData.destruido },
             recusadoCliente: { title: "Recusado Cliente", value: currentKpiData.recusadoCliente },
             naoLocalizado: { title: "Não Localizado", value: currentKpiData.naoLocalizado },
             preparadoEnvio: { title: "Preparado p/ Envio", value: currentKpiData.preparadoEnvio },
             estoqueFlash: { title: "Em Estoque (Flash)", value: currentKpiData.estoqueFlash },
         };
     }, [currentKpiData, previousPeriodEndSaldo, currentPeriodEndingBalance]);

    const stockChartData = useMemo(() => { if (!timeSeriesData || timeSeriesData.length === 0) return { labels: [], datasets: [] }; let dataToUse = timeSeriesData; if (!isMobileView && !isStockChartExpanded && timeSeriesData.length > 3) { dataToUse = timeSeriesData.slice(-3); } const labels = dataToUse.map(d => new Date(d.date + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })); const saldoData = dataToUse.map(d => d.saldo); const saidasData = dataToUse.map(d => d.saidasTotal); const entradasData = dataToUse.map(d => (d.entradasFlash || 0) + (d.entradasInterlog || 0)); const entradasLabel = "Entradas (Total)"; const pointRadius = timeSeriesData.length > 30 ? (isStockChartExpanded ? 1 : 0) : 3; return { labels: labels, datasets: [ { label: 'Saldo', data: saldoData, yAxisID: 'ySaldo', type: 'line', borderColor: '#3b82f6', backgroundColor: '#3b82f633', tension: 0.1, fill: false, pointRadius: pointRadius, pointHoverRadius: 5, spanGaps: true }, { label: entradasLabel, data: entradasData, yAxisID: 'yMov', type: 'bar', borderColor: '#10b981', backgroundColor: '#10b981A0', barPercentage: 0.6, categoryPercentage: 0.7 }, { label: 'Saídas (Total)', data: saidasData, yAxisID: 'yMov', type: 'bar', borderColor: '#ef4444', backgroundColor: '#ef4444A0', barPercentage: 0.6, categoryPercentage: 0.7 } ] }; }, [timeSeriesData, isStockChartExpanded, isMobileView]);
    const stockChartOptions = useMemo(() => ({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { ticks: { font: { size: 10 }, padding: 5, maxRotation: (isMobileView || isStockChartExpanded) ? 60 : 0, autoSkip: !isStockChartExpanded } }, ySaldo: { type: 'linear', position: 'left', beginAtZero: false, title: { display: true, text: 'Saldo', font: { size: 11 } }, ticks: { font: { size: 10 }, callback: function(value) { return formatNumber(value); } }, grid: { drawOnChartArea: true } }, yMov: { type: 'linear', position: 'right', beginAtZero: true, title: { display: true, text: 'Movimentação (Dia)', font: { size: 11 } }, ticks: { font: { size: 10 }, callback: function(value) { return formatNumber(value); } }, grid: { drawOnChartArea: false } } }, plugins: { legend: { position: 'bottom', labels: { font: {size: 11}, usePointStyle: true, pointStyleWidth: 8 } }, tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += formatNumber(context.parsed.y); } return label; } } } } }), [formatNumber, isMobileView, isStockChartExpanded]);
    const stockChartMinWidth = isStockChartExpanded ? `${Math.max(600, (stockChartData?.labels?.length || 0) * (isMobileView ? 35 : 50))}px` : '100%';

    const resendDataGroupedByRegion = useMemo(() => { const grouped = {}; let totalResendsOverall = 0; let totalEntriesWithResends = 0; for (const uf in resendUfData) { const region = ufToRegionMap[uf] || 'INDEFINIDA'; const ufData = resendUfData[uf]; if (!grouped[region]) { grouped[region] = { totalCount: 0, totalResends: 0, states: {} }; } grouped[region].totalCount += ufData.total_count; grouped[region].totalResends += ufData.total_resends; grouped[region].states[uf] = ufData; totalResendsOverall += ufData.total_resends; totalEntriesWithResends += ufData.total_count; } for (const region in grouped) { grouped[region].averageResends = grouped[region].totalCount > 0 ? grouped[region].totalResends / grouped[region].totalCount : 0; grouped[region].states = Object.entries(grouped[region].states).sort(([, a], [, b]) => b.total_count - a.total_count).reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {}); } const overallAverageResends = totalEntriesWithResends > 0 ? totalResendsOverall / totalEntriesWithResends : 0; return { grouped, overallAverageResends, totalEntriesWithResends }; }, [resendUfData]);
    const resendGroupDataWithCost = useMemo(() => { if (!resendGroupData || resendGroupData.length === 0 || !ufAverageCosts || Object.keys(ufAverageCosts).length === 0) { return (resendGroupData || []).map(g => ({ ...g, totalCost: 0 })); } const allCosts = Object.values(ufAverageCosts).filter(c => c !== null && !isNaN(c)); const averageCostOverall = allCosts.length > 0 ? allCosts.reduce((sum, cost) => sum + cost, 0) / allCosts.length : 0; return resendGroupData.map(group => ({ ...group, totalCost: (group.count ?? 0) * averageCostOverall })); }, [resendGroupData, ufAverageCosts]);

    const canUpload = user && user.role !== 'guest';
    const hasData = !isLoading && !error && (!!currentKpiData || timeSeriesData.length > 0 || hasResendData);
    const hasResendData = !isLoading && !error && (Object.keys(resendUfData).length > 0 || resendGroupData.length > 0);

    const renderKPISkeletons = (count = 4) => (
        <div className="kpi-grid grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
         <Box className="bg-white p-4 rounded-lg shadow-md flex flex-col min-h-[400px] mt-6">
             <Skeleton variant="text" width="40%" height={24} sx={{ marginBottom: 2 }} />
             <Skeleton variant="rectangular" width="100%" height={350} className="rounded-lg" />
         </Box>
    );

    const renderResendSkeletons = () => (
        <div className="mt-8">
            <Skeleton variant="text" width="50%" height={32} sx={{ marginBottom: 2 }} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Box className="md:col-span-2 bg-white p-4 rounded-lg shadow-md border border-gray-200 min-h-[300px]">
                     <Skeleton variant="text" width="40%" height={24} sx={{ marginBottom: 2 }} />
                     <Skeleton variant="rectangular" width="100%" height={200} />
                 </Box>
                 <Box className="bg-white p-4 rounded-lg shadow-md border border-gray-200 min-h-[300px]">
                    <Skeleton variant="text" width="50%" height={24} sx={{ marginBottom: 2 }} />
                    <Skeleton variant="text" width="100%" height={20} sx={{ marginBottom: 1 }}/>
                    <Skeleton variant="text" width="100%" height={20} sx={{ marginBottom: 1 }}/>
                    <Skeleton variant="text" width="100%" height={20} sx={{ marginBottom: 1 }}/>
                    <Skeleton variant="text" width="70%" height={20} />
                 </Box>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen relative">
            {isLoading && (
                 <div className="absolute inset-0 bg-white bg-opacity-75 flex items-top justify-center z-40 rounded-lg">
                    <div className="text-center">
                        <LoadingSpinner message="Conteúdo sendo carregado, por favor aguarde..." />
                    </div>
                 </div>
             )}
            <main className={`p-4 lg:p-6 space-y-6 transition-filter duration-300 ${isLoading ? 'blur-sm pointer-events-none' : ''}`}>
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center">
                     <div className="mb-4 lg:mb-0">
                        {isLoading ? <Skeleton variant="text" width={250} height={32} /> : <h2 className="text-2xl font-bold text-gray-800"> Estoque Local (Retornos) </h2>}
                        {isLoading ? <Skeleton variant="text" width={180} height={16} sx={{ marginTop: 1}}/> : <p className="text-xs text-gray-500 mt-1"> Última atualização: {formatDateTime(lastStockUpdate)} </p>}
                    </div>
                    <div className="flex space-x-2"> {canUpload && ( <button onClick={() => setShowUploader(prev => !prev)} className={`btn ${showUploader ? 'btn-secondary' : 'btn-primary'} btn-icon`} data-name="toggle-estoque-uploader-button"><i className={`fas ${showUploader ? 'fa-times' : 'fa-upload'}`}></i><span>{showUploader ? 'Fechar Upload' : 'Carregar Estoque'}</span></button> )} </div>
                </div>
                {showUploader && canUpload && ( <div className="my-6"> <FileUploaderEstoque onFileUpload={handleEstoqueUploadSuccess} user={user} onClose={() => setShowUploader(false)} /> </div> )}
                 <PeriodFilter />
                 <ErrorDisplay error={error ? { message: error } : null} onRetry={() => fetchLocalStockData(period.startDate, period.endDate)} onDismiss={() => setError(null)} />

                {isLoading ? (
                    <>
                        {renderKPISkeletons(4)}
                        {renderKPISkeletons(4)}
                        {renderChartSkeleton()}
                        {renderResendSkeletons()}
                    </>
                 ) : (
                    <>
                        {!error && !currentKpiData && <div className="text-center text-gray-500 py-10">Nenhum dado de estoque encontrado.</div>}
                        {!error && currentKpiData && Object.keys(displayedKPIs).length > 0 && (
                            <>
                                 <div className="kpi-grid grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    <KPIPanel title={displayedKPIs.saldo?.title} value={formatNumber(displayedKPIs.saldo?.value)} comparison={displayedKPIs.saldo?.comparison} />
                                    <KPIPanel title={displayedKPIs.entradasTotal?.title} value={formatNumber(displayedKPIs.entradasTotal?.value)} />
                                    <KPIPanel title={displayedKPIs.saidasTotal?.title} value={formatNumber(displayedKPIs.saidasTotal?.value)} />
                                    <KPIPanel title={displayedKPIs.estoqueFlash?.title} value={formatNumber(displayedKPIs.estoqueFlash?.value)} />
                                </div>
                                <div className="kpi-grid grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                    <KPIPanel title={displayedKPIs.preparadoEnvio?.title} value={formatNumber(displayedKPIs.preparadoEnvio?.value)} />
                                    <KPIPanel title={displayedKPIs.recusadoCliente?.title} value={formatNumber(displayedKPIs.recusadoCliente?.value)} />
                                    <KPIPanel title={displayedKPIs.naoLocalizado?.title} value={formatNumber(displayedKPIs.naoLocalizado?.value)} />
                                    <KPIPanel title={displayedKPIs.destruido?.title} value={formatNumber(displayedKPIs.destruido?.value)} />
                                </div>
                            </>
                        )}

                        {!error && hasData && timeSeriesData.length > 0 && (
                            <div className="bg-white p-4 rounded-lg shadow-md flex flex-col min-h-[400px] mt-6">
                                 <div className="flex justify-between items-center mb-4">
                                     <h3 className="text-base font-semibold text-gray-700">Tendência Estoque Local (Total)</h3>
                                     <button onClick={toggleStockChartExpansion} className="btn btn-secondary btn-xs py-1 px-2">
                                         {isStockChartExpanded ? 'Ver Resumo' : 'Ver Gráfico'}
                                     </button>
                                 </div>
                                 <div className="flex-grow relative h-[350px]">
                                    <div ref={stockChartScrollContainerRef} className={`absolute inset-0 ${isStockChartExpanded ? 'overflow-x-auto' : 'overflow-x-hidden'}`}>
                                         <div style={{ minWidth: stockChartMinWidth, height: '100%' }} className="relative">
                                             <ChartComponent ref={stockChartRef} type="line" data={stockChartData} options={stockChartOptions} />
                                         </div>
                                     </div>
                                 </div>
                            </div>
                        )}
                        {!error && hasData && timeSeriesData.length === 0 && ( <div className="text-center text-gray-500 py-10">Nenhum dado para exibir no gráfico.</div> )}

                         {!error && hasResendData && (
                             <div className="mt-8">
                                 <h3 className="text-xl font-semibold text-gray-800 mb-4">Detalhes de Reenvios (Total Período: {formatNumber(resendDataGroupedByRegion.totalEntriesWithResends ?? 0)}, Média Geral: {formatNumber(resendDataGroupedByRegion.overallAverageResends, 1)})</h3>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                     <div className="md:col-span-2 bg-white p-4 rounded-lg shadow-md border border-gray-200">
                                         <h4 className="text-base font-semibold text-gray-700 mb-3">Contagem por Região/UF</h4>
                                         <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                             {Object.entries(resendDataGroupedByRegion.grouped).sort(([, a], [, b]) => b.totalCount - a.totalCount).map(([region, regionData]) => ( <div key={region} className="bg-gray-50 p-3 rounded-md border border-gray-200"> <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleResendRegionExpansion(region)}> <span className="font-medium text-sm text-gray-800">{region}</span> <div className='flex items-center text-sm'> <span className="text-xs text-gray-500 mr-2" title="Média de Reenvios na Região">Média Reenv.: {formatNumber(regionData.averageResends, 1)}</span> <span className="font-bold mr-2">{formatNumber(regionData.totalCount)}</span> <i className={`fas fa-chevron-down text-gray-500 transition-transform duration-200 ${expandedResendRegion === region ? 'rotate-180' : ''}`}></i> </div> </div> <div className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedResendRegion === region ? 'max-h-60 mt-2 pt-2 border-t border-gray-200' : 'max-h-0'}`} style={{ maxHeight: expandedResendRegion === region ? '15rem' : '0' }}> <div className="space-y-1 pl-2">
                                             <div className="flex justify-between items-center text-xs font-medium text-gray-500 border-b mb-1 pb-0.5">
                                                 <span>Estado</span>
                                                 <span className='flex items-center space-x-2'>
                                                     <span className="w-12 text-right" title="Custo Médio da UF">C.Médio</span>
                                                     <span className="w-10 text-right" title="Média de Reenvios por Cartão">M.Reenv.</span>
                                                     <span className="w-8 text-right" title="Total de Cartões Reenviados">Total</span>
                                                 </span>
                                             </div>
                                             {Object.entries(regionData.states).map(([state, stateData]) => ( <div key={state} className="flex justify-between items-center text-xs"> <span className="text-gray-600">{state}</span> <span className='flex items-center space-x-2'> <span className="text-gray-500 w-12 text-right" title={`Custo Médio da UF ${state}`}>{formatNumber(ufAverageCosts[state] ?? 0, 2, true)}</span> <span className="text-gray-500 w-10 text-right" title={`Média de Reenvios em ${state}`}>{formatNumber(stateData.average_resends, 1)}</span> <span className="font-medium text-gray-700 w-8 text-right">{formatNumber(stateData.total_count)}</span> </span> </div> ))} </div> </div> </div> ))}
                                             {Object.keys(resendDataGroupedByRegion.grouped).length === 0 && <p className="text-sm text-gray-500 italic text-center py-4">Nenhum reenvio registrado.</p>}
                                         </div>
                                     </div>
                                     <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                                        <h4 className="text-base font-semibold text-gray-700 mb-3">Contagem por Grupo de Reenvio</h4>
                                        {resendGroupDataWithCost.length > 0 ? ( <ul className="space-y-2"> {resendGroupDataWithCost.map((group) => ( <li key={group.group} className="flex justify-between items-center text-sm border-b pb-1 last:border-b-0"> <span className="text-gray-700">{group.group}</span> <span className='flex items-center space-x-2'> <span className="text-xs text-gray-500" title={`Custo Total Estimado para ${group.group}`}>({formatNumber(group.totalCost, 2, true)})</span> <span className="font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full text-xs">{formatNumber(group.count)}</span> </span> </li> ))} </ul> ) : ( <p className="text-sm text-gray-500 italic text-center py-4">Nenhum reenvio registrado.</p> )}
                                     </div>
                                 </div>
                             </div>
                         )}
                         {!error && !hasResendData && !isLoading && ( <div className="text-center text-gray-500 py-10">Nenhum dado de reenvio encontrado.</div> )}
                    </>
                 )}
            </main>
        </div>
    );
}