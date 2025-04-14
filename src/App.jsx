import React, { useState, useEffect, Suspense, lazy, useMemo } from 'react';
import getSupabaseClient from './utils/supabaseClient';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

import LoginForm from './components/auth/LoginForm';
import SignupForm from './components/auth/SignupForm';
import GuestLogin from './components/auth/GuestLogin';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import { reportError } from './utils/helpers';
import { FilterProvider } from './contexto/FilterContext'; // Import the FilterProvider

const Dashboard = lazy(() => import('./pages/Dashboard'));
const LogisticaView = lazy(() => import('./pages/LogisticaView'));
const EstoqueView = lazy(() => import('./pages/EstoqueView'));

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error: error }; }
    componentDidCatch(error, errorInfo) { console.error("Uncaught error in boundary:", error, errorInfo); reportError(error, { componentStack: errorInfo.componentStack }); }
    render() { if (this.state.hasError) { return (<div className="p-4 text-center text-red-600 bg-red-100 border border-red-300 rounded-md m-4"> <h1 className="text-lg font-semibold">Algo deu errado.</h1> <p>Por favor, tente atualizar a página ou contate o suporte.</p> {import.meta.env.DEV && this.state.error && (<pre className="mt-2 text-xs text-left whitespace-pre-wrap"> {this.state.error.toString()} </pre>)} </div>); } return this.props.children; }
}

export default function App() {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authView, setAuthView] = useState('login');

    useEffect(() => {
        const supabase = getSupabaseClient();
        let authListener = null;

        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            console.log("[App Auth] Initial session check:", currentSession);
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            setAuthLoading(false);

            const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
                console.log(`[App Auth] Auth state changed. Event: ${_event}`, newSession);
                setSession(newSession);
                setUser(newSession?.user ?? null);
                if (_event === 'SIGNED_OUT') {
                    setAuthView('login');
                    window.location.hash = '';
                }
            });
            authListener = data.subscription;

        }).catch(error => {
            console.error("[App Auth] Error getting initial session:", error);
            setAuthLoading(false);
        });

        return () => {
            if (authListener) {
                console.log("[App Auth] Unsubscribing auth listener.");
                authListener.unsubscribe();
            }
        };
    }, []);


    const getInitialView = () => { const hash = window.location.hash.replace('#/', ''); return ['logistica', 'dashboard', 'estoque'].includes(hash) ? hash : 'dashboard'; };
    const [currentView, setCurrentView] = useState(() => user ? getInitialView() : 'dashboard');
    const [sidebarActive, setSidebarActive] = useState(false);

    useEffect(() => {
        if (!user) return;
        const handleHashChange = () => { setCurrentView(getInitialView()); };
        window.addEventListener('hashchange', handleHashChange);
        setCurrentView(getInitialView());
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const currentHash = window.location.hash.replace('#/', '');
        if (currentView !== currentHash && currentView) {
            window.location.hash = `/${currentView}`;
        }
    }, [currentView, user]);


    const switchToLogin = () => setAuthView('login');
    const switchToSignup = () => setAuthView('signup');
    const switchToGuest = () => setAuthView('guest');

    const handleGuestLogin = (guestUserData) => {
        console.log("[App Auth] Handling guest login");
        setUser(guestUserData);
        setSession(null);
        setAuthLoading(false);
        setCurrentView('dashboard');
        window.location.hash = '#/dashboard';
    };

    const renderView = useMemo(() => {
        const commonProps = { user: user, onNavigate: setCurrentView };
        switch (currentView) {
            case 'logistica': return <LogisticaView {...commonProps} />;
            case 'estoque': return <EstoqueView {...commonProps} />;
            case 'dashboard': default: return <Dashboard user={user} />;
        }
    }, [currentView, user]);


    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '400px', p: 3 }}>
                    <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" width="100%" height={50} sx={{ mb: 1 }} />
                    <Skeleton variant="rectangular" width="100%" height={50} sx={{ mb: 3 }} />
                    <Skeleton variant="rectangular" width="100%" height={40} />
                    <Skeleton variant="text" width="80%" height={20} sx={{ mt: 3 }} />
                </Box>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="auth-container">
                {authView === 'login' && <LoginForm onSwitchToSignup={switchToSignup} onSwitchToGuest={switchToGuest} onSwitchToLogin={switchToLogin} />}
                {authView === 'signup' && <SignupForm onSwitchToLogin={switchToLogin} />}
                {authView === 'guest' && <GuestLogin onGuestLogin={handleGuestLogin} onSwitchToLogin={switchToLogin} onSwitchToSignup={switchToSignup} />}
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <FilterProvider> {/* Wrap the authenticated part with FilterProvider */}
                <div data-name="app-container" className="min-h-screen bg-gray-100 flex">
                    <Sidebar active={sidebarActive} setActive={setSidebarActive} currentView={currentView} setCurrentView={setCurrentView} user={user} />
                    <div data-name="main-content-wrapper" className="flex-1 flex flex-col transition-margin duration-300 ease-in-out md:ml-64">
                        <Header toggleSidebar={() => setSidebarActive(!sidebarActive)} user={user} />
                        <main className="p-4 sm:p-6 flex-1 overflow-y-auto">
                            <Suspense fallback={
                                <div className="space-y-6">
                                    <Skeleton variant="rectangular" width="100%" height={100} />
                                    <Skeleton variant="rectangular" width="100%" height={300} />
                                    <Skeleton variant="rectangular" width="100%" height={200} />
                                </div>
                            }>
                                {renderView}
                            </Suspense>
                        </main>
                    </div>
                </div>
            </FilterProvider>
        </ErrorBoundary>
    );
}