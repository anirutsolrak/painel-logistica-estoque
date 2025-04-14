const columnMappings = {
    logistics: {
        'Total de Tentativas': 'total_tentativas',
        'UF': 'uf',
        'Último Status': 'ultimo_status',
        'Qtde. Reenvios': 'qtde_reenvios',
        'Tipo de Baixa': 'tipo_baixa',
        'Conta': 'conta',
        'Contrato': 'contrato',
        'CPF': 'cpf',
        'Esteira': 'esteira'
    }
};

export function getDisplayHeader(dbColumn, type) {
    const mapping = columnMappings[type];
    return Object.entries(mapping).find(([_, value]) => value === dbColumn)?.[0] || dbColumn;
}

export function getDbColumn(displayHeader, type) {
    return columnMappings[type][displayHeader] || displayHeader;
}