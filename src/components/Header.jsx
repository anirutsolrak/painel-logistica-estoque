import React from 'react';

export default function Header({ toggleSidebar }) {
    return (
        <header data-name="main-header" className="bg-white shadow-md p-4 flex items-center justify-between sticky top-0 z-10">
             {/* Menu button for mobile */}
             <button
                data-name="menu-button"
                className="md:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                onClick={toggleSidebar}
                aria-label="Abrir menu lateral"
            >
                <i className="fas fa-bars text-xl"></i>
            </button>
            {/* Title - ensure it's centered or appropriately placed, hide on very small screens if needed */}
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate text-center md:text-left flex-grow md:flex-grow-0 ml-2 md:ml-0">
                Sistema de Gestão - Logística
            </h1>
             {/* Placeholder for potential user menu or actions on the right */}
             <div className="w-8 md:hidden"></div> {/* Spacer to help center title on mobile */}
        </header>
    );
}