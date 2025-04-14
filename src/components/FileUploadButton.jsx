import React, { useState, useRef } from 'react';
import { handleCSVUpload } from '../utils/fileHandlers';
import { reportError } from '../utils/helpers';

export default function FileUploadButton({ onUpload, label, expectedHeaders, reportType }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef(null); // Ref to clear the input

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            setFileName('');
            return;
        }

        setFileName(file.name);
        setIsLoading(true);
        setError(null);

        try {
            // Pass reportType to handler
            const data = await handleCSVUpload(file, expectedHeaders, reportType);
            await onUpload(data); // Call the parent's upload logic
            // Optionally clear file name on success, or keep it
            // setFileName('');
        } catch (uploadError) {
            console.error('Erro detalhado no upload:', uploadError);
            // Try to provide a user-friendly message
             const message = uploadError instanceof Error ? uploadError.message : 'Ocorreu um erro desconhecido.';
             setError(message);
             reportError(uploadError, { component: 'FileUploadButton', fileName: file.name });

        } finally {
            setIsLoading(false);
             // Reset input value to allow uploading the same file again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };


    return (
        <div data-name="file-upload" className="mb-4">
            <div className="flex items-center space-x-4">
                 {/* Hidden file input */}
                <input
                    type="file"
                    accept=".csv, text/csv, application/vnd.ms-excel"
                    onChange={handleFileChange}
                    disabled={isLoading}
                    ref={fileInputRef}
                    className="hidden"
                    aria-hidden="true" // Hide from accessibility tree as the button triggers it
                />
                 {/* Visible Button */}
                 <button
                    type="button"
                    onClick={triggerFileInput}
                    disabled={isLoading}
                    className={`inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-md cursor-pointer hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150 ${
                         isLoading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                    <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-upload'} mr-2`} aria-hidden="true"></i>
                    {isLoading ? 'Carregando...' : label}
                </button>

                {/* Display file name or loading status */}
                <span className="text-sm text-gray-600 truncate">
                    {isLoading ? 'Processando arquivo...' : fileName || 'Nenhum arquivo selecionado'}
                </span>
            </div>
             {/* Error Display */}
            {error && (
                <div className="mt-2 text-red-600 text-sm" role="alert">
                    <i className="fas fa-exclamation-circle mr-1" aria-hidden="true"></i>
                    <strong>Erro:</strong> {error}
                </div>
            )}
        </div>
    );
}