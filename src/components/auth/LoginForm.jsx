import React, { useState } from 'react';
import getSupabaseClient from '../../utils/supabaseClient'; // Ajuste o caminho se necessário

export default function LoginForm({ onSwitchToSignup, onSwitchToGuest }) {
    const reportError = (error, context = 'LoginForm') => console.error(`[${context}] Error:`, error?.message || error);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const supabase = getSupabaseClient();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            console.log("[Login] Attempting login with:", email);
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            console.log("[Login] Response:", { data, authError });

            if (authError) {
                throw authError; // Deixa o bloco catch lidar com a mensagem
            }

            if (!data?.user) {
                // Isso não deveria acontecer se não houver erro, mas é uma segurança
                throw new Error("Autenticação bem-sucedida, mas sem dados do usuário.");
            }

            // O listener onAuthStateChange no App.jsx cuidará de atualizar a UI
            console.log("[Login] Success. Waiting for state update via listener.");

        } catch (err) {
            console.error("[Login] Failed:", err);
            let userMessage = "Falha no login. Verifique os dados e tente novamente.";

            if (err?.message?.includes("Invalid login credentials")) {
                userMessage = "Email ou senha inválidos.";
            } else if (err?.message?.includes("Email not confirmed")) {
                userMessage = "Email ainda não confirmado. Verifique sua caixa de entrada.";
            } else if (err?.message?.includes("Failed to fetch")) {
                userMessage = "Problema de conexão. Verifique sua internet.";
            } else if (err?.status === 400) {
                 userMessage = "Email ou senha inválidos."; // Erro comum 400
             }

            setError(userMessage);
            reportError(err, 'handleSubmit');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card" data-name="login-form">
            <h2 className="auth-title">Login</h2>

            {error && (
                <div className="error-message mb-4" role="alert" data-name="login-error">
                    <i className="fas fa-exclamation-circle mr-2"></i> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="input-label" htmlFor="login-email">Email</label>
                    <input
                        type="email" id="login-email" className="input-field" value={email}
                        onChange={(e) => setEmail(e.target.value)} required autoComplete="email" data-name="email-input"
                    />
                </div>

                <div>
                    <label className="input-label" htmlFor="login-password">Senha</label>
                    <input
                        type="password" id="login-password" className="input-field" value={password}
                        onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" data-name="password-input"
                    />
                </div>

                <button type="submit" className="btn btn-primary w-full !mt-6" disabled={loading} data-name="login-button">
                    {loading ? (<><i className="fas fa-spinner fa-spin mr-2"></i>Entrando...</>) : ('Entrar')}
                </button>
            </form>

            <div className="auth-footer mt-6 text-sm">
                <p>
                    Não tem uma conta?{' '}
                    <button onClick={onSwitchToSignup} className="auth-link" data-name="signup-link"> Cadastre-se </button>
                </p>
                <p className="mt-2">
                    Ou{' '}
                    <button onClick={onSwitchToGuest} className="auth-link" data-name="guest-link"> acesse como convidado </button>
                </p>
            </div>
        </div>
    );
}