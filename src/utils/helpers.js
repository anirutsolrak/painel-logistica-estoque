export function formatarData(dataString) {
    if (!dataString) return ''; // Add guard against null/undefined dates
    try {
        return new Date(dataString).toLocaleDateString('pt-BR');
    } catch (e) {
        console.error("Error formatting date:", dataString, e);
        return 'Data inválida';
    }
}

export function formatarMoeda(valor) {
    if (typeof valor !== 'number') return ''; // Add guard
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Removed duplicate downloadCSV function, use the one from fileHandlers.js

export function filtrarDados(dados, filtros) {
    if (!dados || !Array.isArray(dados)) return []; // Add guard
    if (!filtros || typeof filtros !== 'object') return dados; // Add guard

    return dados.filter(item => {
        return Object.entries(filtros).every(([chave, valor]) => {
            if (valor === null || valor === undefined || valor === '') return true; // Ignore empty filters

            // Specific filter logic if needed (like date range)
            // if (chave === 'periodoData') {
            //     const itemData = new Date(item.data); // Assuming 'data' field exists
            //     return itemData >= valor.inicio && itemData <= valor.fim;
            // }

            // General case: check if item's value (converted to string) includes filter value (string)
            const itemValue = item[chave];
            if (itemValue === null || itemValue === undefined) return false; // Item doesn't have this key

            // Case-insensitive comparison for strings
            return String(itemValue).toLowerCase().includes(String(valor).toLowerCase());
        });
    });
}

// Basic error reporting function placeholder
export function reportError(error, info = {}) {
    // In a real app, send this to a logging service (Sentry, LogRocket, etc.)
    console.error("Reporting Error:", error, info);
}