import React from 'react';

// NavLink Component (mantido como antes)
const NavLink = ({ currentView, viewName, setView, icon, label, onClick }) => (
    <li>
        <button
            data-name={`${viewName}-link`}
            className={`sidebar-item w-full text-left px-4 py-3 rounded-md text-sm font-medium flex items-center transition-colors duration-150 ${
                currentView === viewName
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            onClick={() => {
                setView(viewName);
                if (onClick) onClick();
            }}
            aria-current={currentView === viewName ? 'page' : undefined}
        >
            <i className={`${icon} mr-3 fa-fw w-4 text-center`} aria-hidden="true"></i>
            {label}
        </button>
    </li>
);


export default function Sidebar({ active, setActive, currentView, setCurrentView }) {
    const closeSidebar = () => setActive(false);

    return (
        <>
            {/* Overlay for mobile (mantido como antes) */}
            <div
                className={`fixed inset-0 bg-black bg-opacity-50 z-20 transition-opacity duration-300 md:hidden ${
                    active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={closeSidebar}
                aria-hidden="true"
            ></div>

            {/* Sidebar */}
            <div
                 data-name="sidebar"
                 className={`sidebar fixed left-0 top-0 h-full w-64 bg-gray-800 text-white p-4 transform transition-transform duration-300 ease-in-out z-30 ${
                     active ? 'translate-x-0' : '-translate-x-full'
                 } md:translate-x-0 md:z-auto`}
                 role="navigation"
                 aria-label="Menu principal"
            >
                <div data-name="sidebar-header" className="flex items-center justify-between mb-8">
                    <h1 className="text-lg font-bold text-white">Gestão Logística</h1>
                    <button
                        data-name="sidebar-close"
                        className="md:hidden text-gray-400 hover:text-white"
                        onClick={closeSidebar}
                        aria-label="Fechar menu lateral"
                    >
                        <i className="fas fa-times fa-lg"></i>
                    </button>
                </div>
                <nav data-name="sidebar-nav">
                    <ul className="space-y-2">
                        <NavLink
                            currentView={currentView}
                            viewName="dashboard"
                            setView={setCurrentView}
                            icon="fas fa-chart-line" // Ícone Dashboard
                            label="Dashboard"
                            onClick={closeSidebar}
                        />
                         <NavLink
                            currentView={currentView}
                            viewName="logistica" // Aponta para a nova view 'logistica'
                            setView={setCurrentView}
                            icon="fas fa-truck" // Ícone Logística
                            label="Logística" // Nome atualizado
                            onClick={closeSidebar}
                        />
                        <NavLink // Novo link para Estoque
                            currentView={currentView}
                            viewName="estoque" // Nome da nova view
                            setView={setCurrentView}
                            icon="fas fa-boxes-stacked" // Ícone para Estoque (exemplo)
                            label="Estoque" // Nome do link
                            onClick={closeSidebar}
                        />
                    </ul>
                </nav>
            </div>
        </>
    );
}