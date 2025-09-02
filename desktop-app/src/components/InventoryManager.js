import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Application Configuration (ezt majd localStorage-ből töltjük)
const getAppConfig = () => {
  const savedConfig = localStorage.getItem('inventoryConfig');
  return savedConfig ? JSON.parse(savedConfig) : {
    appName: "Turbó Szerviz Raktár",
    logoUrl: "",
    labels: {
      parts: "Alkatrészek",
      partTypes: "Alkatrésztípusok", 
      suppliers: "Beszállítók",
      stock: "Készlet",
      search: "Keresés",
      add: "Hozzáadás",
      edit: "Szerkesztés",
      delete: "Törlés",
      settings: "Beállítások",
      code: "Kód",
      type: "Típus",
      supplier: "Beszállító",
      notes: "Jegyzet",
      quantity: "Mennyiség",
      operations: "Műveletek",
      stockIn: "Beraktározás",
      stockOut: "Kiadás",
      newPart: "Új alkatrész hozzáadása",
      management: "kezelése",
      backToMain: "Vissza a főoldalra",
      cancel: "Mégsem",
      save: "Mentés"
    }
  };
};

const saveAppConfig = (config) => {
  localStorage.setItem('inventoryConfig', JSON.stringify(config));
};

const InventoryManager = () => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [movementType, setMovementType] = useState('IN');
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [movements, setMovements] = useState([]);
  const [showMovementLog, setShowMovementLog] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({});

  const categories = [
    { id: 'turbo_parts', name: 'Turbó alkatrészek', icon: '🔧' },
    { id: 'consumables', name: 'Fogyóeszközök', icon: '🧴' },
    { id: 'tools', name: 'Szerszámok', icon: '🔨' },
    { id: 'general', name: 'Általános', icon: '📦' }
  ];

  const movementReasons = {
    'IN': [
      { id: 'purchase', name: 'Beszerzés' },
      { id: 'return', name: 'Visszárú' },
      { id: 'correction', name: 'Javítás' }
    ],
    'OUT': [
      { id: 'usage', name: 'Felhasználás' },
      { id: 'damaged', name: 'Sérült' },
      { id: 'lost', name: 'Elveszett' },
      { id: 'correction', name: 'Javítás' }
    ]
  };

  useEffect(() => {
    loadInventoryData();
    loadDashboardStats();
  }, []);

  useEffect(() => {
    loadItems();
  }, [searchTerm, selectedCategory, showLowStockOnly]);

  const loadInventoryData = async () => {
    try {
      await loadItems();
      setLoading(false);
    } catch (error) {
      console.error('Hiba a raktár adatok betöltésekor:', error);
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category', selectedCategory);
      if (showLowStockOnly) params.append('low_stock_only', 'true');

      const response = await axios.get(`${API}/inventory/items?${params}`);
      setItems(response.data);
    } catch (error) {
      console.error('Hiba az alkatrészek betöltésekor:', error);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/inventory/dashboard`);
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Hiba a dashboard adatok betöltésekor:', error);
    }
  };

  const loadMovements = async (itemId = null) => {
    try {
      const params = itemId ? `?item_id=${itemId}` : '';
      const response = await axios.get(`${API}/inventory/movements${params}`);
      setMovements(response.data);
    } catch (error) {
      console.error('Hiba a mozgások betöltésekor:', error);
    }
  };

  const handleMovement = (item, type) => {
    setSelectedItem(item);
    setMovementType(type);
    setMovementQuantity('');
    setMovementReason('');
    setMovementNotes('');
    setShowMovementModal(true);
  };

  const submitMovement = async () => {
    if (!movementQuantity || !movementReason) {
      alert('Kérem töltse ki az összes kötelező mezőt!');
      return;
    }

    try {
      const movementData = {
        item_id: selectedItem.id,
        movement_type: movementType,
        quantity: parseInt(movementQuantity),
        reason: movementReason,
        notes: movementNotes
      };

      await axios.post(`${API}/inventory/movements`, movementData);
      
      setShowMovementModal(false);
      loadItems();
      loadDashboardStats();
      alert(`${movementType === 'IN' ? 'Bevételezés' : 'Kiadás'} sikeresen rögzítve!`);
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült rögzíteni a mozgást'));
    }
  };

  const getStockStatusColor = (status) => {
    switch (status) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'low': return 'bg-yellow-100 text-yellow-800';
      case 'overstock': return 'bg-purple-100 text-purple-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const getStockStatusText = (status) => {
    switch (status) {
      case 'critical': return '🚨 Kritikus';
      case 'low': return '⚠️ Alacsony';
      case 'overstock': return '📈 Túlkészlet';
      default: return '✅ Rendben';
    }
  };

  const getCategoryIcon = (category) => {
    const cat = categories.find(c => c.id === category);
    return cat ? cat.icon : '📦';
  };

  const initializeDefaultItems = async () => {
    try {
      await axios.post(`${API}/inventory/initialize-default-items`);
      loadItems();
      loadDashboardStats();
      alert('Alapértelmezett alkatrészek hozzáadva!');
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült inicializálni'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Raktár adatok betöltése...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">
                📦 Raktárkezelő
              </h1>
              <p className="text-gray-600">
                Készletkezelés és mozgásnyilvántartás
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  loadMovements();
                  setShowMovementLog(true);
                }}
                className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 text-sm"
              >
                📋 Mozgásnapló
              </button>
              <button
                onClick={initializeDefaultItems}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm"
              >
                ➕ Alapértelmezett alkatrészek
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium"
              >
                🏠 Vissza
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Összes alkatrész</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardStats.total_items || 0}</p>
              </div>
              <span className="text-2xl">📦</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Alacsony készlet</p>
                <p className="text-2xl font-bold text-yellow-900">{dashboardStats.low_stock_items || 0}</p>
              </div>
              <span className="text-2xl">⚠️</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Elfogyott</p>
                <p className="text-2xl font-bold text-red-900">{dashboardStats.out_of_stock_items || 0}</p>
              </div>
              <span className="text-2xl">🚨</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Heti mozgás</p>
                <p className="text-2xl font-bold text-blue-900">{dashboardStats.recent_movements || 0}</p>
              </div>
              <span className="text-2xl">📊</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Készlet érték</p>
                <p className="text-lg font-bold text-green-900">{(dashboardStats.total_stock_value || 0).toFixed(0)} LEI</p>
              </div>
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Keresés név vagy kód szerint..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Minden kategória</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="lowStock"
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="lowStock" className="text-sm font-medium text-gray-700">
                Csak alacsony készlet
              </label>
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alkatrész
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kód
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Készlet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Státusz
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Helység
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Műveletek
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{getCategoryIcon(item.category)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-500">{item.supplier || 'Nincs szállító'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">{item.code}</div>
                      <div className="text-xs text-gray-500">{item.purchase_price.toFixed(0)} LEI</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        {item.current_stock} {item.unit}
                      </div>
                      <div className="text-xs text-gray-500">
                        Min: {item.min_stock} | Max: {item.max_stock}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStockStatusColor(item.stock_status)}`}>
                        {getStockStatusText(item.stock_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.location || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleMovement(item, 'IN')}
                        className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-xs"
                      >
                        ⬆️ IN
                      </button>
                      <button
                        onClick={() => handleMovement(item, 'OUT')}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs"
                        disabled={item.current_stock <= 0}
                      >
                        ⬇️ OUT
                      </button>
                      <button
                        onClick={() => {
                          loadMovements(item.id);
                          setSelectedItem(item);
                          setShowMovementLog(true);
                        }}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs"
                      >
                        📋
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nincs alkatrész a kritériumoknak megfelelően</p>
              <button
                onClick={initializeDefaultItems}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Alapértelmezett alkatrészek hozzáadása
              </button>
            </div>
          )}
        </div>

        {/* Movement Modal */}
        {showMovementModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                {movementType === 'IN' ? '⬆️ Bevételezés' : '⬇️ Kiadás'} - {selectedItem?.name}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mennyiség *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={movementQuantity}
                    onChange={(e) => setMovementQuantity(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="pl. 5"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ok *
                  </label>
                  <select
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Válasszon okot...</option>
                    {movementReasons[movementType]?.map(reason => (
                      <option key={reason.id} value={reason.id}>
                        {reason.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Megjegyzés
                  </label>
                  <textarea
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Opcionális megjegyzés..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Mégsem
                </button>
                <button
                  onClick={submitMovement}
                  className={`px-4 py-2 text-white rounded ${
                    movementType === 'IN' 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {movementType === 'IN' ? '⬆️ Bevételezés' : '⬇️ Kiadás'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Movement Log Modal */}
        {showMovementLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  📋 Mozgásnapló {selectedItem ? `- ${selectedItem.name}` : ''}
                </h3>
                <button
                  onClick={() => setShowMovementLog(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Dátum
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Típus
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Mennyiség
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Készlet
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ok
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Megjegyzés
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {movements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(movement.created_at).toLocaleString('hu-HU')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            movement.movement_type === 'IN' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {movement.movement_type === 'IN' ? '⬆️ IN' : '⬇️ OUT'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {movement.stock_before} → {movement.stock_after}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {movement.reason}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {movement.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {movements.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nincsenek mozgások
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryManager;