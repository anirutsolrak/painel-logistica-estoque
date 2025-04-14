// Note: Mock data might not be needed anymore if you are fetching real data.
// Consider removing this file if unused.

export function generateMockData() {
    const logisticsData = Array.from({ length: 50 }, (_, i) => ({
        // Ensure keys match database column names expected by the application
        total_tentativas: Math.floor(Math.random() * 5) + 1,
        uf: ['RJ', 'SP', 'MG', 'BA', 'RS'][Math.floor(Math.random() * 5)],
        ultimo_status: ['Ciclo Operacional Encerrado', 'Em Rota', 'Aguardando Coleta', 'Entregue', 'Custodia', 'Devolucao'][Math.floor(Math.random() * 6)],
        qtde_reenvios: Math.floor(Math.random() * 3),
        tipo_baixa: ['ENTREGUE_FLASH', 'DEVOLVIDO', 'EXTRAVIADO'][Math.floor(Math.random() * 3)],
        conta: `${Math.floor(Math.random() * 9000000000) + 1000000000}`, // Generate 10-digit number
        contrato: `CTR${Math.floor(Math.random() * 900000) + 100000}`,   // Generate contract number
        cpf: `${Math.floor(Math.random()*999)}.${Math.floor(Math.random()*999)}.${Math.floor(Math.random()*999)}-${Math.floor(Math.random()*99)}`,
        esteira: ['APROVADO CRÉDITO', 'REPROVADO CRÉDITO', 'EM ANÁLISE'][Math.floor(Math.random() * 3)],
        // Add created_at if needed for filtering/sorting by date
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random date in last 30 days
    }));
    // DENTRO do componente Dashboard, junto com os outros mocks

// Mock para o Hero Chart (exemplo para 7 dias)
const mockTimeSeriesGlobal = [
    { date: '2024-03-07', processed: 210, returned: 15 },
    { date: '2024-03-08', processed: 235, returned: 22 },
    { date: '2024-03-09', processed: 220, returned: 18 },
    { date: '2024-03-10', processed: 250, returned: 20 },
    { date: '2024-03-11', processed: 215, returned: 25 },
    { date: '2024-03-12', processed: 230, returned: 12 },
    { date: '2024-03-13', processed: 250, returned: 13 },
];

    // Only return logistics data
    return { logisticsData };
}



// Export the function itself if needed, or call it and export the result
// export const mockData = generateMockData(); // Option 1: Export the data directly