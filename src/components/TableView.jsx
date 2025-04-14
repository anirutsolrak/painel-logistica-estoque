import React from 'react';

export default function TableView({ data, columns, onDownload }) {

    if (!columns || columns.length === 0) {
        return <p className="text-red-600">Erro: Definição de colunas ausente.</p>;
    }

    const hasData = data && data.length > 0;

    return (
        <div data-name="table-view-container" className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div data-name="table-header" className="p-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
                 <h2 className="text-lg font-semibold text-gray-800">Resultados</h2>
                 {onDownload && hasData && ( // Only show download if handler and data exist
                    <button
                        data-name="download-button"
                        className="inline-flex items-center bg-green-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ease-in-out duration-150"
                        onClick={onDownload}
                        aria-label="Baixar resultados em CSV"
                    >
                        <i className="fas fa-download mr-2" aria-hidden="true"></i>
                        Download CSV
                    </button>
                )}
            </div>

            {/* Table Container */}
            <div data-name="table-scroll-container" className="overflow-x-auto">
                 {hasData ? (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data.map((row, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-gray-50 transition-colors duration-150">
                                    {columns.map((column) => (
                                        <td
                                            key={`${rowIndex}-${column.key}`}
                                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                                        >
                                             {/* Apply formatting if provided */}
                                            {column.format ? column.format(row[column.key], row) : (row[column.key] !== null && row[column.key] !== undefined ? String(row[column.key]) : '')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                     <div className="p-6 text-center text-gray-500">
                         Nenhum dado encontrado para os filtros selecionados.
                     </div>
                 )}
            </div>
             {/* Optional: Footer for pagination or total count */}
             {hasData && (
                 <div className="p-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                     Total de registros: {data.length}
                 </div>
             )}
        </div>
    );
}