import getSupabaseClient from './supabaseClient.js';

const reportServiceError = (error, context) => {
    console.error(`[EstoqueService Error - ${context}]`, error?.message || error);
};

async function getAggregatedLocalStockKPIs(startDate, endDate) {
    const context = 'getAggregatedLocalStockKPIs';
    const functionName = 'get_local_stock_aggregated_kpis_v2'; // Usa a nova RPC
    console.log(`[${context}] Calling RPC '${functionName}' for period: ${startDate} to ${endDate}`);
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized");

    try {
        const { data, error } = await supabase.rpc(functionName, { start_date_param: startDate, end_date_param: endDate });
        if (error) { console.error(`[${context}] RPC error:`, error); throw error; }
        console.log(`%c[${context}] RPC result:`, 'color: olive; font-weight: bold;', data);
        return { data: data ?? { saldoAtual: 0, entradasTotal: 0, saidasTotal: 0, entradasFlash: 0, entradasInterlog: 0, destruido: 0, recusadoCliente: 0, naoLocalizado: 0, preparadoEnvio: 0, estoqueFlash: 0, averageCardCost: 0 }, error: null };
    } catch (errorCatch) { reportServiceError(errorCatch, context); return { data: { saldoAtual: 0, entradasTotal: 0, saidasTotal: 0, entradasFlash: 0, entradasInterlog: 0, destruido: 0, recusadoCliente: 0, naoLocalizado: 0, preparadoEnvio: 0, estoqueFlash: 0, averageCardCost: 0 }, error: errorCatch }; }
}

async function getLocalStockBalance(targetDate) {
    const context = 'getLocalStockBalance';
    const functionName = 'get_local_stock_balance_on_date';
    console.log(`[${context}] Calling RPC '${functionName}' for date: ${targetDate}`);
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized");
    try {
        const { data, error } = await supabase.rpc(functionName, { target_date_param: targetDate });
        if (error) { console.error(`[${context}] RPC error:`, error); throw error; }
        console.log(`%c[${context}] RPC result (balance):`, 'color: olive; font-weight: bold;', data);
        return { data: data ?? null, error: null };
    } catch (errorCatch) { reportServiceError(errorCatch, context); return { data: null, error: errorCatch }; }
}

async function getLocalStockTimeSeries(startDate, endDate) {
    const context = 'getLocalStockTimeSeries';
    const functionName = 'get_local_stock_time_series';
    console.log(`[${context}] Calling RPC '${functionName}' for period: ${startDate} to ${endDate}`);
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized");
    try {
        const { data, error } = await supabase.rpc(functionName, { start_date_param: startDate, end_date_param: endDate });
        if (error) { console.error(`[${context}] RPC error:`, error); throw error; }
        console.log(`%c[${context}] RPC result (time series):`, 'color: olive; font-weight: bold;', data);
        return { data: data || [], error: null };
    } catch (errorCatch) { reportServiceError(errorCatch, context); return { data: [], error: errorCatch }; }
}

// Função ajustada para chamar a nova RPC de stats de reenvio por UF
async function getResendStatsByUF(startDate, endDate) {
    const context = 'getResendStatsByUF';
    const functionName = 'get_resend_stats_by_uf'; // Nome da função RPC atualizada
    console.log(`[${context}] Calling RPC '${functionName}' for period: ${startDate} to ${endDate}`);
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized");
    try {
        const { data, error } = await supabase.rpc(functionName, { start_date_param: startDate, end_date_param: endDate });
        if (error) { console.error(`[${context}] RPC error:`, error); throw error; }
        console.log(`%c[${context}] RPC result (resend stats UF):`, 'color: orange; font-weight: bold;', data);
        return { data: data || {}, error: null }; // Retorna objeto { UF: { total_count, total_resends, average_resends } }
    } catch (errorCatch) { reportServiceError(errorCatch, context); return { data: {}, error: errorCatch }; }
}

async function getResendGroupCounts(startDate, endDate) {
    const context = 'getResendGroupCounts';
    const functionName = 'get_resend_group_counts';
    console.log(`[${context}] Calling RPC '${functionName}' for period: ${startDate} to ${endDate}`);
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized");
    try {
        const { data, error } = await supabase.rpc(functionName, { start_date_param: startDate, end_date_param: endDate });
        if (error) { console.error(`[${context}] RPC error:`, error); throw error; }
        console.log(`%c[${context}] RPC result (resends groups):`, 'color: orange; font-weight: bold;', data);
        return { data: data || [], error: null };
    } catch (errorCatch) { reportServiceError(errorCatch, context); return { data: [], error: errorCatch }; }
}

// Função para buscar custos médios de todas as UFs (para mostrar na seção de reenvio)
async function getAllUfAverageCosts() {
    const context = 'getAllUfAverageCosts';
    console.log(`[${context}] Fetching all UF average costs.`);
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized");
    try {
        const { data, error } = await supabase
            .from('uf_average_costs')
            .select('uf, average_cost');
        if (error) { console.error(`[${context}] Error fetching costs:`, error); throw error; }
        // Transforma o array em um objeto { UF: cost } para fácil acesso
        const costMap = data.reduce((acc, item) => {
            acc[item.uf] = item.average_cost;
            return acc;
        }, {});
        console.log(`[${context}] UF Cost Map fetched:`, costMap);
        return { data: costMap, error: null };
    } catch(errorCatch) {
        reportServiceError(errorCatch, context);
        return { data: {}, error: errorCatch };
    }
}


function EstoqueService() {
    return {
        getAggregatedLocalStockKPIs,
        getLocalStockBalance,
        getLocalStockTimeSeries,
        getResendStatsByUF, // Exporta função atualizada
        getResendGroupCounts,
        getAllUfAverageCosts // Exporta nova função para custos
    };
}

export default EstoqueService;