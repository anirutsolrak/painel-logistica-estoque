import React, { useState } from 'react';

export default function GuestLogin({ onGuestLogin }) {
    const reportError = (error, context = 'GuestLogin') => console.error(`[${context}] Error:`, error?.message || error);

    const [loading, setLoading] = useState(false);

    const handleGuestLogin = async () => {
        setLoading(true);
        try {
            // Cria um objeto de usuário simulado para o convidado
            const guestUser = {
                id: 'guest-user', // ID único para convidado
                aud: 'authenticated', // Simula role autenticada para passar verificações básicas
                role: 'guest', // Role específica para lógica de permissão
                email: 'guest@local.app',
                // Adicione outros campos que sua aplicação possa esperar, mesmo que vazios
                app_metadata: { provider: 'guest', providers: ['guest'] },
                user_metadata: { name: 'Convidado' },
                created_at: new Date().toISOString(),
                // Não haverá session real do Supabase
            };

            // Chama o callback passado pelo App.jsx para definir o estado
            onGuestLogin(guestUser);

        } catch (error) {
            console.error('[GuestLogin] Error:', error);
             reportError(error);
             // Talvez mostrar um erro genérico na UI?
        } finally {
            // Não precisa mais de setLoading(false) aqui, pois onGuestLogin deve
            // causar re-renderização pelo App.jsx que removerá este componente.
            // Se houver erro e não navegar, descomente:
            // setLoading(false);
        }
    };

    return (
        <div className="auth-card" data-name="guest-login">
            <h2 className="auth-title">Acesso como Convidado</h2>
            <p className="text-gray-600 mb-6 text-sm">
                Você poderá visualizar os dados, mas as funcionalidades de upload estarão desabilitadas.
            </p>

            <button
                onClick={handleGuestLogin}
                className="btn btn-secondary w-full" // Estilo secundário
                disabled={loading}
                data-name="guest-login-button"
            >
                {loading ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i>Entrando...</>
                ) : (
                    'Entrar como Convidado'
                )}
            </button>

            <div className="auth-footer mt-6 text-sm">
                <p>
                    Para acesso completo,{' '}
                    <button onClick={onSwitchToLogin} className="auth-link" data-name="login-link"> faça login </button>
                    {' '}ou{' '}
                    <button onClick={onSwitchToSignup} className="auth-link" data-name="signup-link"> cadastre-se </button>.
                </p>
            </div>
        </div>
    );
}