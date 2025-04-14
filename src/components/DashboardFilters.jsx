import React, { useState, useEffect } from 'react';
import { reportError } from '../utils/helpers'; // Import error reporting

export default function DashboardFilters({ filtros, setFiltros }) {
    const [contaOptions, setContaOptions] = useState([]);
    const [esteiraOptions, setEsteiraOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);


    useEffect(() => {
        const loadOptions = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch options concurrently
          
                // Sort options alphabetically or numerically if needed
                setContaOptions(contaData.sort());
                setEsteiraOptions(esteiraData.sort());
            } catch (err) {
                console.error('Erro ao carregar opções de filtro:', err);
                setError('Falha ao carregar opções de filtro.');
                reportError(err, { component: 'DashboardFilters' });
            } finally {
                setIsLoading(false);
            }
        };

        loadOptions();
    }, []); // Empty dependency array means this runs once on mount

    const handleFilterChange = (key, value) => {
        setFiltros(prevFilters => ({
            ...prevFilters,
            [key]: value,
        }));
    };

    return (
        <div data-name="dashboard-filters" className="bg-white p-4 rounded-lg shadow-md mb-6 border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {/* Conta Filter */}
                <div>
                    <label htmlFor="filter-conta" className="block text-sm font-medium text-gray-700 mb-1">
                        Conta
                    </label>
                    <select
                        id="filter-conta"
                        name="conta"
                        className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-50"
                        value={filtros.conta || ''}
                        onChange={(e) => handleFilterChange('conta', e.target.value)}
                        disabled={isLoading}
                        aria-describedby={isLoading ? 'loading-options-conta' : undefined}
                    >
                        <option value="">Todos</option>
                        {contaOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                    {isLoading && <span id="loading-options-conta" className="text-xs text-gray-500">Carregando...</span>}
                </div>

                {/* Esteira Filter */}
                <div>
                    <label htmlFor="filter-esteira" className="block text-sm font-medium text-gray-700 mb-1">
                        Esteira
                    </label>
                    <select
                        id="filter-esteira"
                        name="esteira"
                        className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-50"
                        value={filtros.esteira || ''}
                        onChange={(e) => handleFilterChange('esteira', e.target.value)}
                        disabled={isLoading}
                        aria-describedby={isLoading ? 'loading-options-esteira' : undefined}
                    >
                        <option value="">Todos</option>
                        {esteiraOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                    {isLoading && <span id="loading-options-esteira" className="text-xs text-gray-500">Carregando...</span>}
                </div>
            </div>
             {error && (
                <p className="text-red-600 text-sm mt-2" role="alert">{error}</p>
            )}
        </div>
    );
}