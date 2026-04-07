import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Utensils, Lock } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (data.success) {
        login(data.user, data.token);
      } else {
        setError(data.message || 'Erro ao fazer login');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(`Erro: ${err.message || 'Desconhecido'}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-orange-500 p-3 rounded-full mb-4">
            <Utensils className="text-zinc-950 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Burger Manager</h1>
          <p className="text-zinc-400 text-sm mt-1">Acesso ao Sistema</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-1">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              placeholder="Digite seu usuário"
              required
            />
          </div>
          <div>
            <label className="block text-zinc-400 text-sm mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              placeholder="Digite sua senha"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-zinc-950 font-bold py-3 rounded-lg transition-colors mt-4 flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
