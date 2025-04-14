import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
// Removido import de reportError se não existir em helpers
// import { reportError } from '../utils/helpers';
import { insertLocalStockEntries, upsertUfAverageCosts } from '../utils/supabaseClient'; // Ajuste o caminho se necessário

// Cabeçalhos esperados (MAIÚSCULAS E SEM ACENTOS PARA COMPARAÇÃO)
const expectedSheet1HeadersNormalized = ["CONTRATO", "UF", "DATA", "STATUS CAPITAL", "REENVIO"];
const expectedSheet2HeadersNormalized = ["UF", "MEDIA DE VALORES"];

// Função para normalizar cabeçalhos (remover acentos, espaços extras, maiúsculas)
const normalizeHeader = (header) => {
    if (typeof header !== 'string') return '';
    return header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

export default function FileUploaderEstoque({ onFileUpload, user, onClose }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef(null);

    const getPartnerFromStatus = (status) => {
        if (!status || typeof status !== 'string') return 'DESCONHECIDO';
        const upperStatus = status.toUpperCase();
        if (upperStatus.includes('FLASH')) return 'FLASH';
        if (upperStatus.includes('INTERLOG')) return 'INTERLOG';
        return 'OUTRO';
    };

    const parseCurrency = (value) => {
        if (value === null || value === undefined) return null;
        // Se já for número, retorna
        if (typeof value === 'number' && !isNaN(value)) return value;
        // Se for string, tenta limpar
        if (typeof value === 'string') {
            try {
                const cleanedValue = value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                const number = parseFloat(cleanedValue);
                return isNaN(number) ? null : number;
            } catch (e) {
                console.error("[parseCurrency] Erro ao parsear string:", value, e);
                return null;
            }
        }
        // Se for outro tipo, loga e retorna null
        console.warn(`[parseCurrency] Tipo inesperado recebido: ${typeof value}, valor: ${value}`);
        return null;
    };

    const parseDate = (value) => {
        if (value === null || value === undefined) return null;
        // Se já for data JS válida
        if (value instanceof Date && !isNaN(value.getTime())) {
            try {
                // Formata consistentemente para YYYY-MM-DD (UTC para evitar timezone shift)
                const year = value.getUTCFullYear();
                const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
                const day = value.getUTCDate().toString().padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (e) {
                 console.warn(`[parseDate] Erro ao formatar objeto Date:`, value, e);
                 return null;
            }
        }
        // Se for número (serial Excel)
        if (typeof value === 'number') {
            try {
                // XLSX.SSF.parse_date_code pode ser impreciso ou lançar erros
                // Usar date:'iso' no read pode ser melhor, mas tentamos manualmente
                const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Base do Excel
                const jsMillis = excelEpoch.getTime() + value * 24 * 60 * 60 * 1000;
                const jsDate = new Date(jsMillis);
                if (!isNaN(jsDate.getTime())) {
                     const year = jsDate.getUTCFullYear();
                     const month = (jsDate.getUTCMonth() + 1).toString().padStart(2, '0');
                     const day = jsDate.getUTCDate().toString().padStart(2, '0');
                     return `${year}-${month}-${day}`;
                 }
            } catch (e) {
                console.warn(`[parseDate] Não foi possível converter número serial Excel ${value}`, e);
            }
        }
        // Se for string, tenta parsear
        if (typeof value === 'string') {
            // Primeiro, tenta formato YYYY-MM-DD diretamente
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return value;
            }
            // Tenta parse genérico, mas cuidado com formatos ambíguos (DD/MM vs MM/DD)
            const date = new Date(value + 'T00:00:00Z');
            if (!isNaN(date.getTime())) {
                 const year = date.getUTCFullYear();
                 const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                 const day = date.getUTCDate().toString().padStart(2, '0');
                 return `${year}-${month}-${day}`;
            }
        }
        console.warn(`[parseDate] Formato de data não reconhecido ou inválido: ${value} (tipo: ${typeof value})`);
        return null;
    };


    const processExcelFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const arrayBuffer = event.target.result;
                    console.log("[Process Excel] Lendo workbook...");
                    // Tentar com cellDates: true primeiro
                    const workbook = XLSX.read(arrayBuffer, { type: 'buffer', cellDates: true });
                    console.log("[Process Excel] Workbook lido. Abas:", workbook.SheetNames);

                    if (workbook.SheetNames.length < 2) {
                        throw new Error("Arquivo precisa conter pelo menos 2 abas (Estoque e Custos).");
                    }

                    // --- Processa Aba 1 (Estoque) ---
                    const sheet1Name = workbook.SheetNames[0];
                    const sheet1 = workbook.Sheets[sheet1Name];
                    console.log(`[Process Excel] Processando Aba 1: "${sheet1Name}"`);
                    // Usar sheet_to_json com header: 1 para validação
                    const rawData1 = XLSX.utils.sheet_to_json(sheet1, { header: 1, defval: null, blankrows: false }); // blankrows: false para pular linhas vazias
                    console.log(`[Process Excel] Aba 1 - Primeiras 5 linhas brutas:`, rawData1.slice(0, 5));

                    if (!rawData1 || rawData1.length < 2) throw new Error(`Aba "${sheet1Name}" vazia ou só com cabeçalho.`);

                    // Normaliza os cabeçalhos lidos do arquivo
                    const fileHeaders1 = rawData1[0].map(normalizeHeader);
                    console.log("[Process Excel] Aba 1 - Cabeçalhos Normalizados:", fileHeaders1);

                    // Validação normalizada
                    const missingHeaders1 = expectedSheet1HeadersNormalized.filter(eh => !fileHeaders1.includes(eh));
                    if (missingHeaders1.length > 0) {
                        throw new Error(`Cabeçalhos ausentes na Aba 1: ${missingHeaders1.join(', ')}. Esperados: ${expectedSheet1HeadersNormalized.join(', ')}`);
                    }
                    // Mapeia cabeçalho normalizado para seu índice no arquivo
                    const headerIndexMap1 = expectedSheet1HeadersNormalized.reduce((acc, header) => {
                        acc[header] = fileHeaders1.indexOf(header);
                        return acc;
                    }, {});
                    console.log("[Process Excel] Aba 1 - Mapeamento de Índices:", headerIndexMap1);


                    const stockEntries = [];
                    for (let i = 1; i < rawData1.length; i++) {
                        const row = rawData1[i];
                        // Pula linhas que não têm o número esperado de colunas (pode indicar linhas vazias no final)
                        if (row.length < expectedSheet1HeadersNormalized.length) continue;

                        const entryDate = parseDate(row[headerIndexMap1["DATA"]]);
                        const resendCount = parseInt(row[headerIndexMap1["REENVIO"]], 10);
                        const ufValue = row[headerIndexMap1["UF"]];

                        // Log detalhado da primeira linha processada
                        if (i === 1) {
                            console.log(`[Process Excel] Aba 1 - Linha ${i+1} RAW:`, row);
                            console.log(`[Process Excel] Aba 1 - Linha ${i+1} Parsed: Date=${entryDate}, Resend=${resendCount}, UF=${ufValue}`);
                        }

                        if (!ufValue || !entryDate) {
                             console.warn(`[Process Excel] Aba 1 Linha ${i + 1} ignorada: UF ou Data inválida.`);
                             continue;
                         }

                        stockEntries.push({
                            contract: row[headerIndexMap1["CONTRATO"]] ? String(row[headerIndexMap1["CONTRATO"]]) : null,
                            uf: String(ufValue).toUpperCase().trim().substring(0, 2), // Garante 2 chars
                            entry_date: entryDate,
                            status_capital: row[headerIndexMap1["STATUS CAPITAL"]] ? String(row[headerIndexMap1["STATUS CAPITAL"]]) : null,
                            partner: getPartnerFromStatus(row[headerIndexMap1["STATUS CAPITAL"]]),
                            resend_count: isNaN(resendCount) ? 0 : resendCount,
                        });
                    }

                    // --- Processa Aba 2 (Custos) ---
                    const sheet2Name = workbook.SheetNames[1];
                    const sheet2 = workbook.Sheets[sheet2Name];
                    console.log(`[Process Excel] Processando Aba 2: "${sheet2Name}"`);
                    const rawData2 = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: null, blankrows: false });
                    console.log(`[Process Excel] Aba 2 - Primeiras 5 linhas brutas:`, rawData2.slice(0, 5));

                    if (!rawData2 || rawData2.length < 2) throw new Error(`Aba "${sheet2Name}" vazia ou só com cabeçalho.`);

                    const fileHeaders2 = rawData2[0].map(normalizeHeader);
                    console.log("[Process Excel] Aba 2 - Cabeçalhos Normalizados:", fileHeaders2);

                    const missingHeaders2 = expectedSheet2HeadersNormalized.filter(eh => !fileHeaders2.includes(eh));
                    if (missingHeaders2.length > 0) {
                        throw new Error(`Cabeçalhos ausentes na Aba 2: ${missingHeaders2.join(', ')}. Esperados: ${expectedSheet2HeadersNormalized.join(', ')}`);
                    }
                    const headerIndexMap2 = expectedSheet2HeadersNormalized.reduce((acc, header) => {
                        acc[header] = fileHeaders2.indexOf(header);
                        return acc;
                    }, {});
                     console.log("[Process Excel] Aba 2 - Mapeamento de Índices:", headerIndexMap2);

                    const ufCosts = [];
                    for (let i = 1; i < rawData2.length; i++) {
                        const row = rawData2[i];
                        if (row.length < expectedSheet2HeadersNormalized.length) continue;

                        const uf = row[headerIndexMap2["UF"]] ? String(row[headerIndexMap2["UF"]]).toUpperCase().trim().substring(0, 2) : null;
                        const rawCost = row[headerIndexMap2["MEDIA DE VALORES"]];
                        const averageCost = parseCurrency(rawCost);

                         // Log detalhado da primeira linha processada
                         if (i === 1) {
                            console.log(`[Process Excel] Aba 2 - Linha ${i+1} RAW:`, row);
                            console.log(`[Process Excel] Aba 2 - Linha ${i+1} Parsed: UF=${uf}, RawCost=${rawCost}, ParsedCost=${averageCost}`);
                        }

                        if (uf && averageCost !== null) {
                            ufCosts.push({ uf: uf, average_cost: averageCost });
                        } else {
                            console.warn(`[Process Excel] Aba 2 Linha ${i + 1} ignorada: UF ou Custo inválido. UF=${uf}, Custo Bruto=${rawCost}, Custo Parseado=${averageCost}`);
                        }
                    }

                    console.log(`[Process Excel] Finalizado. Entradas Estoque: ${stockEntries.length}, Custos UF: ${ufCosts.length}`);
                    resolve({ stockEntries, ufCosts });

                } catch (err) {
                    console.error("[Process Excel] Erro durante processamento:", err);
                    reject(new Error(`Falha ao processar arquivo: ${err.message}`));
                }
            };
            reader.onerror = (error) => {
                console.error("[File Reader] Erro:", error);
                reject(new Error("Não foi possível ler o arquivo."));
            };
            reader.readAsArrayBuffer(file);
        });
    };


    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) { setFileName(''); return; }
        const allowedExtensions = ['.xlsx', '.xls'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            setError("Formato inválido. Apenas Excel (.xlsx, .xls).");
            setFileName('');
             if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setFileName(file.name);
        setIsLoading(true);
        setError(null);
        console.log(`[File Upload] Iniciando processamento para: ${file.name}`);

        try {
            const { stockEntries, ufCosts } = await processExcelFile(file);

            // *** Log antes de enviar ***
            console.log(`[File Upload] Enviando ${stockEntries.length} entradas de estoque e ${ufCosts.length} custos UF para Supabase...`);

            const results = await Promise.allSettled([
                insertLocalStockEntries(stockEntries),
                upsertUfAverageCosts(ufCosts)
            ]);

            const stockResult = results[0];
            const costResult = results[1];
            let errors = [];
            let successSummary = {};

            if (stockResult.status === 'rejected') {
                console.error("[File Upload] Falha ao inserir estoque:", stockResult.reason);
                errors.push(`Erro Estoque: ${stockResult.reason?.message || 'Desconhecido'}`);
            } else {
                 successSummary.processedStockEntries = stockResult.value?.data?.length ?? 0; // Quantos foram inseridos
                 console.log("[File Upload] Resultado inserção estoque:", stockResult.value);
             }

            if (costResult.status === 'rejected') {
                console.error("[File Upload] Falha ao upsert custos:", costResult.reason);
                 errors.push(`Erro Custos: ${costResult.reason?.message || 'Desconhecido'}`);
            } else {
                 successSummary.processedUfCosts = costResult.value?.data?.length ?? 0; // Quantos foram upserted
                 console.log("[File Upload] Resultado upsert custos:", costResult.value);
             }

            if (errors.length > 0) {
                throw new Error(errors.join(' | '));
            }

            console.log("[File Upload] Processamento concluído com sucesso!", successSummary);
            if (onFileUpload) {
                 onFileUpload(successSummary); // Passa resumo real
             }

        } catch (uploadError) {
            console.error('[File Upload] Erro final no handleFileChange:', uploadError);
             const message = uploadError instanceof Error ? uploadError.message : 'Erro desconhecido durante upload/processamento.';
             setError(message);
             // reportError(uploadError, { component: 'FileUploaderEstoque', fileName: file.name });
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            console.log("[File Upload] Processo finalizado.");
        }
    };

    const triggerFileInput = () => { /* ... (sem alterações) ... */ setError(null); if (fileInputRef.current) { fileInputRef.current.click(); } };

    return (
        <div data-name="file-upload-container" className="file-upload-container">
             {onClose && ( <button onClick={onClose} className="modal-close absolute top-2 right-3 text-xl" aria-label="Fechar uploader"> × </button> )}
            <input type="file" accept=".xlsx, .xls, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} disabled={isLoading} ref={fileInputRef} className="hidden" aria-hidden="true" />
            <div className="text-center">
                 <i className="fas fa-file-excel text-4xl text-green-600 mb-3 upload-icon"></i>
                 <p className="file-upload-text"> Arraste e solte um arquivo Excel aqui ou{' '} <button type="button" onClick={triggerFileInput} disabled={isLoading} className="upload-link font-semibold text-blue-600 hover:text-blue-800 focus:outline-none"> clique para selecionar </button>. </p>
                 <p className="text-xs text-gray-500">O arquivo deve conter as abas de Estoque e Custos.</p>
                 {fileName && !isLoading && ( <p className="text-sm text-gray-700 mt-2 truncate"> Arquivo selecionado: <span className="font-medium">{fileName}</span> </p> )}
                 {isLoading && ( <p className="text-sm text-blue-600 mt-2 animate-pulse"> Processando arquivo: {fileName}... </p> )}
                {error && ( <div className="file-upload-error mt-3" role="alert"> <i className="fas fa-exclamation-circle mr-1"></i> {error} </div> )}
            </div>
        </div>
    );
}