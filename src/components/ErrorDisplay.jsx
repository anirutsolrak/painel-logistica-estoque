import React from 'react';
import { reportError } from '../utils/helpers'; // Assuming reportError is in helpers

export default function ErrorDisplay({ error, onRetry, onDismiss }) {
    // No internal try-catch here; let Error Boundaries handle component errors

    if (!error) return null;

    // Log the error when it's displayed
    React.useEffect(() => {
        reportError(error, { component: 'ErrorDisplay' });
    }, [error]);


    return (
        <div data-name="error-display" className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
            <div className="flex">
                <div className="py-1">
                     <i className="fas fa-exclamation-circle fa-lg text-red-500 mr-3"></i>
                </div>
                <div>
                    <p className="font-bold">Ocorreu um erro</p>
                    <p className="text-sm">{error.message || 'Erro desconhecido.'}</p>
                    {error.details && Array.isArray(error.details) && error.details.length > 0 && (
                        <ul className="list-disc list-inside mt-2 text-sm">
                            {error.details.map((detail, index) => (
                                <li key={index}>{typeof detail === 'string' ? detail : JSON.stringify(detail)}</li>
                            ))}
                        </ul>
                    )}
                    <div className="mt-3">
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="mr-3 text-sm font-medium text-red-700 hover:text-red-900 underline"
                            >
                                Tentar novamente
                            </button>
                        )}
                        {onDismiss && (
                            <button
                                type="button"
                                onClick={onDismiss}
                                className="text-sm font-medium text-red-700 hover:text-red-900 underline"
                            >
                                Dispensar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}