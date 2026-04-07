import React from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './components/Login';
import WaiterModule from './components/WaiterModule';
import AdminModule from './components/AdminModule';
import { Utensils, LogOut } from 'lucide-react';

function MainLayout() {
  const { user, token, logout } = useAuth();

  if (!user || !token) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-lg">
            <Utensils className="text-zinc-950 w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-zinc-100">Burger Manager</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-zinc-400">
            Logado como <span className="text-zinc-100 font-medium">{user.username}</span> ({user.role})
          </div>
          <button 
            onClick={logout}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1">
        {user.role === 'ADM' ? <AdminModule /> : <WaiterModule />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

