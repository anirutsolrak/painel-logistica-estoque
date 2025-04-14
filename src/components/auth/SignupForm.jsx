import React, { useState } from 'react';
import getSupabaseClient from '../../utils/supabaseClient'; // Ajuste o caminho se necessário

export default function SignupForm({ onSwitchToLogin }) {
    const reportError = (error, context = 'SignupForm') => console.error(`[${context}] Error:`, error?.message || error);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }
    const [loading, setLoading] = useState(false);
    const supabase = getSupabaseClient();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem.' });
            setLoading(false);
            return;
        }
        if (password.length < 6) {
            setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
            setLoading(false);
            return;
        }

        try {
            // A URL de redirecionamento é para onde o usuário volta APÓS clicar no link de confirmação
            const redirectUrl = window.location.origin + window.location.pathname; // Volta para a mesma página base
            console.log("[Signup] Attempting signup for:", email, "Redirect URL:", redirectUrl);

            const { data, error: signupError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: redirectUrl
                    // Você pode adicionar 'data' aqui para passar roles ou metadados iniciais, se configurado no Supabase
                    // data: { role: 'user', display_name: 'Novo Usuário' }
                }
            });

            console.log("[Signup] Response:", { data, signupError });

            if (signupError) {
                throw signupError;
            }

            // Verifica o resultado específico do Supabase
            if (data.user && data.session === null) {
                // Usuário criado, mas precisa confirmar email
                 setMessage({ type: 'success', text: 'Cadastro quase completo! Verifique seu email para o link de confirmação.' });
                 // Limpar campos? Opcional.
                 // setEmail(''); setPassword(''); setConfirmPassword('');
            } else if (data.user && data.session) {
                 // Usuário criado E logado (se a confirmação de email estiver desativada no Supabase)
                 setMessage({ type: 'success', text: 'Cadastro e login realizados com sucesso!' });
                 // O listener onAuthStateChange no App.jsx deve pegar essa sessão
             } else {
                 // Caso inesperado
                 setMessage({ type: 'error', text: 'Ocorreu um problema inesperado. Tente novamente.' });
             }

        } catch (err) {
            console.error("[Signup] Failed:", err);
            let userMessage = 'Falha no cadastro. Verifique os dados e tente novamente.';
            if (err?.message?.includes("User already registered")) {
                userMessage = 'Este email já está cadastrado. Tente fazer login.';
            } else if (err?.message?.includes("valid email")) {
                userMessage = 'Por favor, insira um endereço de email válido.';
            } else if (err?.status === 429) {
                userMessage = 'Muitas tentativas. Tente novamente mais tarde.';
            }
            setMessage({ type: 'error', text: userMessage });
            reportError(err, 'handleSubmit');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card" data-name="signup-form">
            <h2 className="auth-title">Cadastro</h2>

            {message && (
                <div className={`message mb-4 px-4 py-3 rounded relative text-sm ${message.type === 'success' ? 'bg-green-100 border border-green-400 text-green-800' : 'bg-red-100 border border-red-400 text-red-800'}`} role="alert" data-name="signup-message">
                    <strong className="font-semibold">
                        {message.type === 'success' ? <i className="fas fa-check-circle mr-2"></i> : <i className="fas fa-exclamation-circle mr-2"></i>}
                        {message.type === 'success' ? 'Sucesso!' : 'Erro:'}
                    </strong>
                    <span className="block sm:inline ml-1">{message.text}</span>
                </div>
            )}

            {/* Só mostra o form se não tiver mensagem de sucesso */}
            {!(message?.type === 'success') && (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="input-label" htmlFor="signup-email">Email</label>
                        <input type="email" id="signup-email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" data-name="email-input"/>
                    </div>
                    <div>
                        <label className="input-label" htmlFor="signup-password">Senha (mín. 6 caracteres)</label>
                        <input type="password" id="signup-password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" autoComplete="new-password" data-name="password-input"/>
                    </div>
                    <div>
                        <label className="input-label" htmlFor="signup-confirm-password">Confirmar Senha</label>
                        <input type="password" id="signup-confirm-password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength="6" autoComplete="new-password" data-name="confirm-password-input"/>
                    </div>
                    <button type="submit" className="btn btn-primary w-full !mt-6" disabled={loading} data-name="signup-button">
                        {loading ? (<><i className="fas fa-spinner fa-spin mr-2"></i>Cadastrando...</>) : ('Cadastrar')}
                    </button>
                </form>
            )}

            <div className="auth-footer mt-6 text-sm">
                <p>
                    Já tem uma conta?{' '}
                    <button onClick={onSwitchToLogin} className="auth-link" data-name="login-link"> Faça login </button>
                </p>
            </div>
        </div>
    );
}