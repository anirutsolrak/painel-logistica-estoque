import { getDbColumn } from './columnMapping'; // Import necessary function

function validateCSVHeaders(headers, expectedHeaders) {
    if (!Array.isArray(expectedHeaders) || !Array.isArray(headers)) {
        throw new Error('Headers inválidos. Por favor, verifique o formato do arquivo.');
    }

    const cleanHeaders = headers.map(h => h.replace(/^\uFEFF/, '').trim());
    const normalizedHeaders = cleanHeaders.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const normalizedExpectedHeaders = expectedHeaders.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    const missingHeaders = normalizedExpectedHeaders.filter(header =>
        !normalizedHeaders.includes(header)
    );

    if (missingHeaders.length > 0) {
        // Try to find similar headers (case/accent insensitive) for better error message
        const presentHeadersLower = cleanHeaders.map(h => h.toLowerCase());
        const missingButSimilar = missingHeaders.filter(mh => presentHeadersLower.includes(mh));
        if (missingButSimilar.length > 0) {
             throw new Error(`Cabeçalhos obrigatórios ausentes ou com formatação incorreta (maiúsculas/minúsculas/acentos): ${missingHeaders.join(', ')}. Verifique se correspondem exatamente a: ${expectedHeaders.join(', ')}`);
        } else {
             throw new Error(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(', ')}`);
        }
    }

    // Return the original headers found in the file for mapping, not the expected ones
    return cleanHeaders;
}


export function handleCSVUpload(file, expectedHeaders, reportType) { // Added reportType
    return new Promise((resolve, reject) => {
        try {
            if (!file) {
                throw new Error('Nenhum arquivo selecionado.');
            }

            // Allow common CSV MIME types
             const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
             if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
                 throw new Error(`Tipo de arquivo inválido (${file.type || 'desconhecido'}). O arquivo deve ser .csv.`);
            }


            if (!Array.isArray(expectedHeaders)) {
                throw new Error('Configuração de cabeçalhos esperados inválida.');
            }
             if (!reportType) {
                 throw new Error('Tipo de relatório (reportType) não especificado para mapeamento de colunas.');
             }

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const text = event.target.result;
                    if (!text) {
                        throw new Error('O arquivo está vazio.');
                    }

                    const lines = text.split(/\r?\n/).filter(line => line.trim());
                    if (lines.length < 2) {
                        throw new Error('O arquivo CSV deve conter pelo menos um cabeçalho e uma linha de dados.');
                    }

                    let delimiter = ',';
                    let fileHeaders = lines[0].split(delimiter).map(h => h.trim());

                    if (fileHeaders.length <= 1 && lines[0].includes(';')) {
                        delimiter = ';';
                        fileHeaders = lines[0].split(delimiter).map(h => h.trim());
                         if (fileHeaders.length <= 1) {
                            throw new Error('Não foi possível detectar o delimitador do CSV (vírgula ou ponto e vírgula). Verifique o formato do arquivo.');
                        }
                    }

                    // Remove potential BOM and validate against expected headers (case/accent insensitive)
                    const validatedHeaders = validateCSVHeaders(fileHeaders, expectedHeaders);


                    const data = lines.slice(1).map((line, index) => {
                        const values = line.split(delimiter).map(v => v.trim());
                        if (values.length !== validatedHeaders.length) {
                            // Provide more context in the error message
                            console.warn(`Linha ${index + 2}: Número de campos (${values.length}) diferente do cabeçalho (${validatedHeaders.length}). Linha: "${line}"`);
                            // Decide whether to throw an error or skip the line
                            // Option 1: Skip the line
                            // return null;
                            // Option 2: Throw an error
                             throw new Error(`Linha ${index + 2}: Número de campos (${values.length}) não corresponde ao número de cabeçalhos (${validatedHeaders.length}). Verifique a linha e o delimitador ('${delimiter}').`);
                        }

                        const row = {};
                        validatedHeaders.forEach((header, i) => {
                            // Map the display header from the file to the DB column name
                            const dbColumn = getDbColumn(header, reportType);
                            // Ensure we use the actual header from the file for lookup if no mapping exists
                            row[dbColumn || header] = values[i] !== undefined ? values[i] : '';
                        });
                        return row;
                    }).filter(row => row !== null); // Filter out skipped lines if using Option 1 above

                    if (data.length === 0) {
                        throw new Error('Nenhuma linha de dados válida encontrada no arquivo após o cabeçalho.');
                    }

                    resolve(data);
                } catch (error) {
                    console.error('Erro ao processar CSV:', error);
                    reject(error); // Reject with the specific error
                }
            };

            reader.onerror = (error) => {
                console.error('Erro na leitura do arquivo:', error);
                reject(new Error('Erro ao ler o arquivo. Verifique se o arquivo não está corrompido ou sendo usado por outro programa.'));
            };

             reader.readAsText(file, 'UTF-8'); // Specify encoding if possible
        } catch (error) {
            console.error('Erro ao iniciar upload:', error);
            reject(error);
        }
    });
}


export function downloadCSV(dados, nomeArquivo, columnsToExport) { // Added columnsToExport
    try {
        if (!dados || !Array.isArray(dados) || dados.length === 0) {
             console.warn('Tentativa de download CSV sem dados válidos.');
            throw new Error('Não há dados válidos para download.');
        }

        if (!columnsToExport || !Array.isArray(columnsToExport) || columnsToExport.length === 0) {
            console.warn('Colunas para exportação não especificadas.');
            throw new Error('É necessário definir as colunas para exportar no formato { key: "db_col", label: "Display Header" }.');
        }

        // Extract display headers from columnsToExport
        const cabecalhos = columnsToExport.map(col => col.label);

        const conteudoCSV = [
            cabecalhos.join(','), // Header row with display names
            ...dados.map(linha =>
                columnsToExport.map(col => {
                    // Get data using the database key (col.key)
                    const value = linha[col.key];
                    // Handle potential commas, quotes, and newlines in data
                    let formattedValue = (value === null || value === undefined) ? '' : String(value);
                    // Escape double quotes by doubling them and enclose in double quotes if necessary
                     if (formattedValue.includes(',') || formattedValue.includes('"') || formattedValue.includes('\n')) {
                        formattedValue = `"${formattedValue.replace(/"/g, '""')}"`;
                    }
                    return formattedValue;
                }).join(',') // Join values for the row
            )
        ].join('\n'); // Join all rows

        // Add BOM for better Excel compatibility with UTF-8 characters
        const blob = new Blob(['\uFEFF' + conteudoCSV], { type: 'text/csv;charset=utf-8;' });

        // Use FileSaver.js logic if available, otherwise fallback to simple link click
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            // For IE / Edge
             window.navigator.msSaveOrOpenBlob(blob, `${nomeArquivo}.csv`);
        } else {
            // For other browsers
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `${nomeArquivo}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href); // Clean up blob URL
        }

    } catch (error) {
        console.error('Erro ao gerar CSV:', error);
        // Provide a more specific error message if possible
        throw new Error(`Falha ao gerar arquivo CSV: ${error.message || 'Erro desconhecido'}. Por favor, tente novamente.`);
    }
}