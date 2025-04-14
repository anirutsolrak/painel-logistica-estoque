import React from 'react';

function LoadingOverlay({ isLoading, message }) {
    const reportError = (error) => console.error("LoadingOverlay Error:", error);
    try {
        if (!isLoading) return null;

        return (
            <div className="overlay active" data-name="loading-overlay">
                <div className="text-center">
                    <div className="loading-spinner" data-name="spinner"></div>
                    {message && <p className="loading-text" data-name="loading-message">{message}</p>}
                </div>
            </div>
        );
    } catch (error) {
        console.error('LoadingOverlay component error:', error);
        reportError(error);
        return null;
    }
}

export default LoadingOverlay;