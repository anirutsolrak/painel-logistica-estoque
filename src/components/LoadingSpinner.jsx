import React from 'react';

export default function LoadingSpinner({ message }) {
    // Removed try-catch as it's generally not needed in simple functional components
    // Error boundaries are a better pattern for catching rendering errors
    return (
        <div data-name="loading-spinner" className="flex flex-col items-center justify-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            {message && (
                <p className="mt-2 text-gray-600">{message}</p>
            )}
        </div>
    );
}