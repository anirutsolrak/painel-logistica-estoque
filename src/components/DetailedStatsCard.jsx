import React from 'react';

// Sub-component for individual statistic items
const StatItem = ({ rotulo, valor, destaque, motivo, motivos }) => (
    <div>
        <div className="flex justify-between items-start text-sm">
            <span className="text-gray-600">{rotulo}:</span>
            <div className="text-right ml-2"> {/* Added margin-left */}
                <span className={`font-semibold ${destaque ? 'text-red-600' : 'text-gray-800'}`}>
                    {valor}
                </span>
            </div>
        </div>
        {/* Conditional rendering for 'motivo' or 'motivos' */}
        {motivo && (
            <div className="text-xs text-gray-500 mt-1 pl-2 italic">
                {motivo}
            </div>
        )}
        {motivos && Array.isArray(motivos) && motivos.length > 0 && (
            <div className="text-xs text-gray-500 mt-1 pl-2">
                <strong>Motivos:</strong>
                <ul className="list-disc pl-4 mt-0.5">
                    {motivos.map((motivoItem, idx) => (
                        <li key={idx}>{motivoItem}</li>
                    ))}
                </ul>
            </div>
        )}
    </div>
);

export default function DetailedStatsCard({ titulo, estatisticas, icone }) {
    // Basic validation
    if (!titulo || !Array.isArray(estatisticas) || !icone) {
        console.warn("DetailedStatsCard missing required props:", { titulo, estatisticas, icone });
        return <div className="p-4 text-red-600">Erro: Dados do card de estatísticas incompletos.</div>;
    }

    return (
        <div data-name="detailed-stats-card" className="bg-white p-4 md:p-6 rounded-lg shadow-md border border-gray-200 h-full flex flex-col">
            {/* Card Header */}
            <div className="flex items-center mb-4 pb-3 border-b border-gray-200">
                <i className={`${icone} text-xl mr-3 text-blue-600 fa-fw`} aria-hidden="true"></i>
                <h3 className="text-lg font-semibold text-gray-800">{titulo}</h3>
            </div>

            {/* Statistics Sections */}
            <div className="space-y-4 flex-grow"> {/* flex-grow to push content */}
                {estatisticas.map((secao, index) => {
                    // Validate section data
                    if (!secao || !secao.titulo || !Array.isArray(secao.itens)) {
                        console.warn("Invalid section data in DetailedStatsCard:", secao);
                        return <p key={`section-error-${index}`} className="text-xs text-red-500">Seção de dados inválida.</p>;
                    }
                    return (
                        <div key={index} className="pt-2 first:pt-0">
                             {/* Section Title (only if more than one section) */}
                             {estatisticas.length > 1 && (
                                <h4 className="font-medium text-gray-700 mb-2 text-sm">{secao.titulo}</h4>
                             )}
                             {/* Statistic Items */}
                            <div className="space-y-2">
                                {secao.itens.map((item, i) => {
                                    // Validate item data
                                    if (!item || item.rotulo === undefined || item.valor === undefined) {
                                         console.warn("Invalid item data in DetailedStatsCard section:", item);
                                         return <p key={`item-error-${i}`} className="text-xs text-red-500">Item de dados inválido.</p>;
                                    }
                                    return <StatItem key={i} {...item} />;
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}