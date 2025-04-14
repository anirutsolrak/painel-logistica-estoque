import React from 'react';

export default function FilterPanel({ filters, setFilters, filterOptions }) {

    const handleFilterChange = (key, value) => {
        setFilters(prevFilters => ({
            ...prevFilters,
            [key]: value
        }));
    };

    if (!filterOptions || Object.keys(filterOptions).length === 0) {
        return null; // Don't render if there are no options
    }

    return (
        <div data-name="filter-panel" className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
            <h3 className="text-md font-semibold mb-3 text-gray-700">Filtrar Resultados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(filterOptions).map(([key, options]) => {
                    // Assuming options is an array of { value: string, label: string }
                    if (!Array.isArray(options)) {
                        console.warn(`Filter options for "${key}" are not an array.`);
                        return null;
                    }

                    // Generate a readable label from the key
                     const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // e.g., ultimo_status -> Ultimo Status

                    return (
                        <div key={key}>
                            <label htmlFor={`filter-${key}`} className="block text-sm font-medium text-gray-600 mb-1">
                                {label}
                            </label>
                            <select
                                id={`filter-${key}`}
                                name={key}
                                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                                value={filters[key] || ''} // Controlled component
                                onChange={(e) => handleFilterChange(key, e.target.value)}
                            >
                                <option value="">Todos</option>
                                {options.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}