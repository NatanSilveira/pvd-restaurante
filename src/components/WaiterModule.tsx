import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Plus, Minus, Trash2, Printer, Send, Search, Utensils } from 'lucide-react';
import { printReceipt } from '../lib/printReceipt';

type MenuItem = {
  id: number;
  name: string;
  category: string;
  price: number;
};

type OrderItem = {
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
  notes: string;
};

export default function WaiterModule() {
  const { user, token, logout } = useAuth();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState<'Local' | 'Delivery'>('Local');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<{ id: number; customer: string; type: string; items: OrderItem[]; total: number } | null>(null);

  useEffect(() => {
    fetch('/api/menu', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401 || res.status === 403) logout();
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setMenu(data);
      })
      .catch(() => {});
  }, [token, logout]);

  const addToOrder = (item: MenuItem) => {
    const existing = orderItems.find(i => i.menu_item_id === item.id && i.notes === '');
    if (existing) {
      setOrderItems(orderItems.map(i => 
        i === existing ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setOrderItems([...orderItems, { 
        menu_item_id: item.id, 
        name: item.name, 
        price: item.price, 
        quantity: 1, 
        notes: '' 
      }]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newItems = [...orderItems];
    newItems[index].quantity += delta;
    if (newItems[index].quantity <= 0) {
      newItems.splice(index, 1);
    }
    setOrderItems(newItems);
  };

  const updateNotes = (index: number, notes: string) => {
    const newItems = [...orderItems];
    newItems[index].notes = notes;
    setOrderItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const submitOrder = async () => {
    if (!customerName.trim()) {
      alert('Preencha o nome do cliente/mesa');
      return;
    }
    if (orderItems.length === 0) {
      alert('Adicione itens ao pedido');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_name: customerName,
          type: orderType,
          items: orderItems,
          waiter_id: user?.id
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setReceiptData({
          id: data.id,
          customer: customerName,
          type: orderType,
          items: [...orderItems],
          total: total
        });
        setCustomerName('');
        setOrderItems([]);
      } else if (res.status === 401 || res.status === 403) {
        logout();
      } else {
        alert('Erro ao enviar pedido');
      }
    } catch (e) {
      alert('Erro de conexão');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMenu = menu.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] bg-zinc-950 text-zinc-100">
      {/* Menu Section */}
      <div className="flex-1 p-6 md:overflow-y-auto border-b md:border-b-0 md:border-r border-zinc-800">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Cardápio</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMenu.map(item => (
            <div 
              key={item.id} 
              onClick={() => addToOrder(item)}
              className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl cursor-pointer hover:border-orange-500 hover:bg-zinc-800/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium group-hover:text-orange-400 transition-colors">{item.name}</h3>
                <span className="text-orange-500 font-bold">R$ {item.price.toFixed(2)}</span>
              </div>
              <span className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded-md">{item.category}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Order Section */}
      <div className="w-full md:w-[400px] lg:w-[450px] bg-zinc-900 flex flex-col md:h-full">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold mb-4">Nova Comanda</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Cliente / Mesa</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500"
                placeholder="Ex: Mesa 04"
              />
            </div>
            
            <div className="flex gap-2 p-1 bg-zinc-950 rounded-lg">
              <button
                onClick={() => setOrderType('Local')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${orderType === 'Local' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Local
              </button>
              <button
                onClick={() => setOrderType('Delivery')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${orderType === 'Delivery' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Delivery
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {orderItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500">
              <Utensils className="w-12 h-12 mb-2 opacity-20" />
              <p>Nenhum item adicionado</p>
            </div>
          ) : (
            orderItems.map((item, index) => (
              <div key={index} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <div className="flex justify-between items-start mb-3">
                  <div className="font-medium">{item.name}</div>
                  <div className="font-bold text-orange-500">R$ {(item.price * item.quantity).toFixed(2)}</div>
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 bg-zinc-900 rounded-lg p-1">
                    <button onClick={() => updateQuantity(index, -1)} className="p-1 hover:text-orange-500"><Minus className="w-4 h-4" /></button>
                    <span className="w-6 text-center font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(index, 1)} className="p-1 hover:text-orange-500"><Plus className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => removeItem(index)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => updateNotes(index, e.target.value)}
                  placeholder="Observações (ex: sem cebola)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-900">
          <div className="flex justify-between items-center mb-4">
            <span className="text-zinc-400">Total</span>
            <span className="text-2xl font-bold text-white">R$ {total.toFixed(2)}</span>
          </div>
          
          <button
            onClick={submitOrder}
            disabled={isSubmitting || orderItems.length === 0 || !customerName}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              'Enviando...'
            ) : (
              <>
                <Printer className="w-5 h-5" />
                Enviar para Cozinha
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal de Impressão (Cupom) */}
      {receiptData && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-black p-6 w-full max-w-[300px] font-mono text-sm relative shadow-2xl">
            <button 
              onClick={() => setReceiptData(null)}
              className="absolute -top-10 right-0 text-white hover:text-orange-500 font-sans font-bold"
            >
              Fechar (X)
            </button>
            
            <div className="text-center mb-4">
              <h3 className="font-bold text-lg">HAMBURGUERIA</h3>
              <p>Pedido #{receiptData.id}</p>
              <p>Tipo: {receiptData.type}</p>
              <p>Cliente: {receiptData.customer}</p>
            </div>
            
            <div className="border-t border-dashed border-black my-2"></div>
            
            <div className="space-y-2 my-4">
              {receiptData.items.map((item, idx) => (
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
            
            {receiptData.tip > 0 && (
              <div className="mb-2 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>R$ {(receiptData.total - receiptData.tip).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gorjeta (10%):</span>
                  <span>R$ {receiptData.tip.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between font-bold text-base mt-4">
              <span>TOTAL:</span>
              <span>R$ {receiptData.total.toFixed(2)}</span>
            </div>
            
            <div className="text-center mt-8 text-xs">
              <p>*** FIM DA IMPRESSÃO ***</p>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => printReceipt(receiptData)}
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
