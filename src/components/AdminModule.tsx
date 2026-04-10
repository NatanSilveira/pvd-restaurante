import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Menu as MenuIcon, DollarSign, LogOut, Printer } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { printReceipt } from '../lib/printReceipt';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'menu' | 'finance'>('dashboard');
  const [orders, setOrders] = useState<any[]>([]);
  const [completingOrder, setCompletingOrder] = useState<number | null>(null);
  const [cancelingOrder, setCancelingOrder] = useState<number | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');

  const fetchOrders = () => {
    fetch('/api/orders', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setOrders(data);
      });
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchOrders();
      const interval = setInterval(fetchOrders, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [activeTab, token]);

  const updateOrderStatus = async (id: number, status: string) => {
    if (status === 'completed') {
      setCompletingOrder(id);
      return;
    }

    await fetch(`/api/orders/${id}/status`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
  };

  const confirmCompleteOrder = async () => {
    if (!completingOrder) return;
    const method = paymentMethod || 'Não Informado';
    await fetch(`/api/orders/${completingOrder}/status`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'completed', payment_method: method })
    });
    setOrders(orders.map(o => o.id === completingOrder ? { ...o, status: 'completed', payment_method: method } : o));
    setCompletingOrder(null);
    setPaymentMethod('');
  };

  const confirmCancelOrder = async () => {
    if (!cancelingOrder) return;
    await fetch(`/api/orders/${cancelingOrder}/status`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'cancelled' })
    });
    setOrders(orders.map(o => o.id === cancelingOrder ? { ...o, status: 'cancelled' } : o));
    setCancelingOrder(null);
  };

  return (
    <>
    <div className="flex h-[calc(100vh-64px)] bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-4 flex flex-col gap-2">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-orange-500 text-zinc-950 font-bold' : 'hover:bg-zinc-800 text-zinc-400'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          Pedidos Ativos
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'users' ? 'bg-orange-500 text-zinc-950 font-bold' : 'hover:bg-zinc-800 text-zinc-400'}`}
        >
          <Users className="w-5 h-5" />
          Equipe
        </button>
        <button 
          onClick={() => setActiveTab('menu')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'menu' ? 'bg-orange-500 text-zinc-950 font-bold' : 'hover:bg-zinc-800 text-zinc-400'}`}
        >
          <MenuIcon className="w-5 h-5" />
          Cardápio
        </button>
        <button 
          onClick={() => setActiveTab('finance')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'finance' ? 'bg-orange-500 text-zinc-950 font-bold' : 'hover:bg-zinc-800 text-zinc-400'}`}
        >
          <DollarSign className="w-5 h-5" />
          Financeiro
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Pedidos em Andamento</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {orders.filter(o => o.status === 'pending' || o.status === 'preparing').map(order => (
                <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{order.customer_name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-md ${order.type === 'Delivery' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                        {order.type}
                      </span>
                    </div>
                    <span className="text-zinc-500 text-sm">#{order.id}</span>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    {order.items.map((item: any, i: number) => (
                      <div key={i} className="text-sm">
                        <div className="flex justify-between">
                          <span><span className="text-orange-500 font-bold">{item.quantity}x</span> {item.name}</span>
                        </div>
                        {item.notes && <div className="text-zinc-500 text-xs ml-6 bg-zinc-950 p-1 rounded mt-1">Obs: {item.notes}</div>}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setViewingReceipt(order)}
                      className="px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-2 rounded-lg text-sm font-medium transition-colors"
                      title="Ver Cupom"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-zinc-950 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      Concluir
                    </button>
                    <button 
                      onClick={() => setCancelingOrder(order.id)}
                      className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2 rounded-lg text-sm font-bold transition-colors"
                      title="Cancelar Pedido"
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
              {orders.filter(o => o.status === 'pending' || o.status === 'preparing').length === 0 && (
                <div className="col-span-full text-center py-12 text-zinc-500">
                  Nenhum pedido em andamento.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'finance' && <FinanceModule />}
        {activeTab === 'menu' && <MenuManager />}
        {activeTab === 'users' && <UserManager />}
      </div>

      {/* Modal Concluir Pedido */}
      {completingOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Concluir Pedido #{completingOrder}</h3>
            <label className="block text-sm text-zinc-400 mb-3">Selecione o Método de Pagamento</label>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              {['PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito'].map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors border ${
                    paymentMethod === method 
                      ? 'bg-orange-500 border-orange-500 text-zinc-950' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => {
                  setCompletingOrder(null);
                  setPaymentMethod('');
                }} 
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmCompleteOrder} 
                disabled={!paymentMethod}
                className="px-4 py-2 bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-bold rounded-lg transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Cancelar Pedido */}
      {cancelingOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Cancelar Pedido #{cancelingOrder}</h3>
            <p className="text-zinc-400 mb-6">Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelingOrder(null)} className="px-4 py-2 text-zinc-400 hover:text-white">Voltar</button>
              <button onClick={confirmCancelOrder} className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg">Sim, Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão (Cupom) */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-black p-6 w-full max-w-[300px] font-mono text-sm relative shadow-2xl">
            <button 
              onClick={() => setViewingReceipt(null)}
              className="absolute -top-10 right-0 text-white hover:text-orange-500 font-sans font-bold"
            >
              Fechar (X)
            </button>
            
            <div className="text-center mb-4">
              <h3 className="font-bold text-lg">HAMBURGUERIA</h3>
              <p>Pedido #{viewingReceipt.id}</p>
              <p>Tipo: {viewingReceipt.type}</p>
              <p>Cliente: {viewingReceipt.customer_name}</p>
            </div>
            
            <div className="border-t border-dashed border-black my-2"></div>
            
            <div className="space-y-2 my-4">
              {viewingReceipt.items.map((item: any, idx: number) => (
                <div key={idx}>
                  <div className="flex justify-between font-bold">
                    <span>{item.quantity}x {item.name}</span>
                    <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.notes && <div className="pl-4 text-xs">* Obs: {item.notes}</div>}
                </div>
              ))}
            </div>
            
            <div className="border-t border-dashed border-black my-2"></div>
            
            <div className="flex justify-between font-bold text-base mt-4">
              <span>TOTAL:</span>
              <span>R$ {viewingReceipt.total.toFixed(2)}</span>
            </div>
            
            <div className="text-center mt-8 text-xs">
              <p>*** FIM DA IMPRESSÃO ***</p>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => printReceipt(viewingReceipt)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-zinc-950 font-bold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function FinanceModule() {
  const { token } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [date, setDate] = useState(() => {
    const now = new Date();
    const spTimeStr = now.toLocaleString('en-US', {timeZone: 'America/Sao_Paulo', hour12: false});
    const spDate = new Date(spTimeStr);
    if (spDate.getHours() < 5) spDate.setDate(spDate.getDate() - 1);
    const year = spDate.getFullYear();
    const month = String(spDate.getMonth() + 1).padStart(2, '0');
    const day = String(spDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  useEffect(() => {
    fetch(`/api/reports/commercial-day?date=${date}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setReport(data));
  }, [date, token]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Fechamento de Caixa</h2>
        <input 
          type="date" 
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500"
        />
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl mb-8 text-sm">
        <strong>Dia Comercial:</strong> O sistema considera vendas das 05:00 do dia selecionado até as 04:59 do dia seguinte.
      </div>

      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
              <div className="text-zinc-400 text-sm mb-2">Total Vendido</div>
              <div className="text-3xl font-bold text-white">R$ {report.total_revenue.toFixed(2)}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
              <div className="text-zinc-400 text-sm mb-2">Total de Pedidos</div>
              <div className="text-3xl font-bold text-white">{report.total_orders}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
              <div className="text-zinc-400 text-sm mb-2">Ticket Médio</div>
              <div className="text-3xl font-bold text-white">R$ {report.average_ticket.toFixed(2)}</div>
            </div>
          </div>

          <h3 className="text-xl font-bold mb-4">Métodos de Pagamento</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-zinc-950 border-b border-zinc-800">
                <tr>
                  <th className="p-4 font-medium text-zinc-400">Método</th>
                  <th className="p-4 font-medium text-zinc-400 text-right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.payment_methods).map(([method, amount]: [string, any]) => (
                  <tr key={method} className="border-b border-zinc-800/50">
                    <td className="p-4 capitalize">{method || 'Não Informado'}</td>
                    <td className="p-4 text-right">R$ {amount.toFixed(2)}</td>
                  </tr>
                ))}
                {Object.keys(report.payment_methods).length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-4 text-center text-zinc-500">Nenhum pagamento registrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MenuManager() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [deletingItem, setDeletingItem] = useState<number | null>(null);

  const fetchMenu = () => {
    fetch('/api/menu', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setItems(data);
      });
  };

  useEffect(() => {
    fetchMenu();
  }, [token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, category, price: parseFloat(price) })
    });
    if (res.ok) {
      setName(''); setCategory(''); setPrice('');
      fetchMenu();
    } else {
      alert('Erro ao adicionar item ao cardápio');
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingItem(id);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    const res = await fetch(`/api/menu/${deletingItem}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setItems(items.filter(i => i.id !== deletingItem));
    } else {
      alert('Erro ao remover item');
    }
    setDeletingItem(null);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Gestão de Cardápio</h2>
      <form onSubmit={handleAdd} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-8 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">Nome do Produto</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2" />
        </div>
        <div className="w-48">
          <label className="block text-sm text-zinc-400 mb-1">Categoria</label>
          <input required type="text" value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2" />
        </div>
        <div className="w-32">
          <label className="block text-sm text-zinc-400 mb-1">Preço (R$)</label>
          <input required type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2" />
        </div>
        <button type="submit" className="bg-orange-500 text-zinc-950 font-bold px-6 py-2 rounded-lg h-[42px]">Adicionar</button>
      </form>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-950 border-b border-zinc-800">
            <tr>
              <th className="p-4 font-medium text-zinc-400">Nome</th>
              <th className="p-4 font-medium text-zinc-400">Categoria</th>
              <th className="p-4 font-medium text-zinc-400">Preço</th>
              <th className="p-4 font-medium text-zinc-400 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-zinc-800/50">
                <td className="p-4">{item.name}</td>
                <td className="p-4"><span className="bg-zinc-800 px-2 py-1 rounded text-xs">{item.category}</span></td>
                <td className="p-4">R$ {item.price.toFixed(2)}</td>
                <td className="p-4">
                  <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:underline text-sm">Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deletingItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Remover Item</h3>
            <p className="text-zinc-400 mb-6">Tem certeza que deseja remover este item do cardápio?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingItem(null)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserManager() {
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Garçom');
  const [deletingUser, setDeletingUser] = useState<number | null>(null);

  const fetchUsers = () => {
    fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username, password, role })
    });
    if (res.ok) {
      setUsername(''); setPassword('');
      fetchUsers();
    } else {
      alert('Erro ao adicionar usuário. Verifique se o nome já existe.');
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingUser(id);
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    const res = await fetch(`/api/users/${deletingUser}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setUsers(users.filter(u => u.id !== deletingUser));
    } else {
      alert('Erro ao remover usuário');
    }
    setDeletingUser(null);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Gestão de Equipe</h2>
      <form onSubmit={handleAdd} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-8 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">Usuário</label>
          <input required type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2" />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">Senha</label>
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2" />
        </div>
        <div className="w-48">
          <label className="block text-sm text-zinc-400 mb-1">Nível</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white">
            <option value="Garçom">Garçom</option>
            <option value="ADM">Administrador</option>
          </select>
        </div>
        <button type="submit" className="bg-orange-500 text-zinc-950 font-bold px-6 py-2 rounded-lg h-[42px]">Adicionar</button>
      </form>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-950 border-b border-zinc-800">
            <tr>
              <th className="p-4 font-medium text-zinc-400">Usuário</th>
              <th className="p-4 font-medium text-zinc-400">Nível de Acesso</th>
              <th className="p-4 font-medium text-zinc-400 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-zinc-800/50">
                <td className="p-4">{u.username}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${u.role === 'ADM' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>{u.role}</span></td>
                <td className="p-4">
                  {u.username !== 'admin' && (
                    <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:underline text-sm">Remover</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deletingUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Remover Usuário</h3>
            <p className="text-zinc-400 mb-6">Tem certeza que deseja remover este usuário?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingUser(null)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
