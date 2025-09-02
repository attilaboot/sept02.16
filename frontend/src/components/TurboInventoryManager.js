import React, { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Application Configuration (localStorage alapú)
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

// Utility komponensek
const SearchBar = ({ onSearch, searchTerm, setSearchTerm, config }) => {
  const placeholderText = config?.labels ? 
    `${config.labels.search || 'Keresés'} ${(config.labels.parts || 'alkatrészek').toLowerCase()} ${(config.labels.code || 'kód').toLowerCase()}, ${(config.labels.type || 'típus').toLowerCase()}, ${(config.labels.supplier || 'beszállító').toLowerCase()} vagy ${(config.labels.notes || 'jegyzet').toLowerCase()} szerint...` :
    'Keresés alkatrészek kód, típus, beszállító vagy jegyzet szerint...';

  return (
    <div className="mb-6">
      <div className="relative">
        <input
          type="text"
          placeholder={placeholderText}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
        />
        <button
          onClick={onSearch}
          className="absolute right-2 top-2 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 font-medium"
        >
          🔍 {config?.labels?.search || 'Keresés'}
        </button>
      </div>
    </div>
  );
};

const PartsTable = ({ parts, onStockMovement, onEdit, onDelete, config }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {config.labels.code}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {config.labels.type}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {config.labels.supplier}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {config.labels.notes}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {config.labels.stock}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {config.labels.operations}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {parts.map((part) => (
              <tr key={part.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {part.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {part.part_type_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {part.supplier_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={part.notes || "-"}>
                  {part.notes || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className={`font-bold ${part.stock_quantity < 0 ? 'text-red-600' : part.stock_quantity <= 5 && part.stock_quantity > 0 ? 'text-yellow-600' : part.stock_quantity === 0 ? 'text-gray-600' : 'text-green-600'}`}>
                    {part.stock_quantity} db
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => onStockMovement(part.id, 'IN')}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-xs font-medium"
                  >
                    📥 IN
                  </button>
                  <button
                    onClick={() => onStockMovement(part.id, 'OUT')}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs font-medium"
                  >
                    📤 OUT
                  </button>
                  <button
                    onClick={() => onEdit(part)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs font-medium"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDelete(part.id)}
                    className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-xs font-medium"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {parts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nincs találat
        </div>
      )}
    </div>
  );
};

const StockMovementModal = ({ partId, partName, partCode, movementType, onClose, onSubmit, config }) => {
  const [quantity, setQuantity] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (quantity <= 0) {
      alert(`A ${config.labels.quantity.toLowerCase()}nek pozitív számnak kell lennie!`);
      return;
    }
    onSubmit(partId, movementType, quantity);
    setQuantity(1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">
          Készletmozgás - {movementType === 'IN' ? config.labels.stockIn : config.labels.stockOut}
        </h3>
        <p className="text-gray-600 mb-4">
          <strong>Alkatrész kód:</strong> {partCode}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {config.labels.quantity} (db)
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-lg"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className={`flex-1 text-white px-4 py-3 rounded hover:opacity-90 font-medium ${
                movementType === 'IN' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {movementType === 'IN' ? `📥 ${config.labels.stockIn}` : `📤 ${config.labels.stockOut}`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white px-4 py-3 rounded hover:bg-gray-600 font-medium"
            >
              {config.labels.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const QuickAddForm = ({ partTypes, suppliers, onSubmit, config }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    part_type_id: "",
    supplier_id: "",
    notes: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code || !formData.part_type_id || !formData.supplier_id) {
      alert("Kód, típus és beszállító kitöltése kötelező!");
      return;
    }
    onSubmit(formData);
    setFormData({ code: "", part_type_id: "", supplier_id: "", notes: "" });
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="mb-6">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-medium"
        >
          ➕ {config.labels.newPart}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-4">{config.labels.newPart}</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {config.labels.code} *
          </label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({...formData, code: e.target.value})}
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            placeholder="pl. CHR001..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {config.labels.type} *
          </label>
          <select
            value={formData.part_type_id}
            onChange={(e) => setFormData({...formData, part_type_id: e.target.value})}
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Válassz típust...</option>
            {partTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {config.labels.supplier} *
          </label>
          <select
            value={formData.supplier_id}
            onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Válassz beszállítót...</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {config.labels.notes}
          </label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            placeholder="pl. Megjegyzés..."
          />
        </div>
        
        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center gap-2 font-medium"
          >
            ✅ {config.labels.add}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 font-medium"
          >
            {config.labels.cancel}
          </button>
        </div>
      </form>
    </div>
  );
};

// Főoldal komponens
const TurboInventoryManager = () => {
  const [parts, setParts] = useState([]);
  const [partTypes, setPartTypes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [stockModal, setStockModal] = useState(null);
  const [editingPart, setEditingPart] = useState(null);
  const [config, setConfig] = useState(getAppConfig());

  // Listen for config changes
  useEffect(() => {
    const handleStorageChange = () => {
      setConfig(getAppConfig());
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also check for config changes periodically
    const interval = setInterval(() => {
      setConfig(getAppConfig());
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Adatok betöltése
  const loadParts = async (search = '') => {
    try {
      const response = await axios.get(`${API}/parts${search ? `?search=${search}` : ''}`);
      setParts(response.data);
    } catch (error) {
      console.error('Hiba az alkatrészek betöltésekor:', error);
    }
  };

  const loadPartTypes = async () => {
    try {
      const response = await axios.get(`${API}/part-types`);
      setPartTypes(response.data);
    } catch (error) {
      console.error('Hiba az alkatrésztípusok betöltésekor:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await axios.get(`${API}/suppliers`);
      setSuppliers(response.data);
    } catch (error) {
      console.error('Hiba a beszállítók betöltésekor:', error);
    }
  };

  const initializeData = async () => {
    try {
      await axios.post(`${API}/initialize-data`);
      await loadPartTypes();
      await loadSuppliers();
    } catch (error) {
      console.error('Hiba az adatok inicializálásakor:', error);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await initializeData();
      await loadParts();
      setLoading(false);
    };
    initialize();
  }, []);

  // Refresh config when returning from settings
  useEffect(() => {
    const refreshConfig = () => {
      const newConfig = getAppConfig();
      setConfig(newConfig);
    };
    
    // Listen for focus events (when user returns to tab)
    window.addEventListener('focus', refreshConfig);
    
    return () => {
      window.removeEventListener('focus', refreshConfig);
    };
  }, []);

  // Keresés
  const handleSearch = () => {
    loadParts(searchTerm);
  };

  // Alkatrész hozzáadása/szerkesztése
  const handlePartSubmit = async (formData) => {
    try {
      if (editingPart) {
        await axios.put(`${API}/parts/${editingPart.id}`, formData);
        setEditingPart(null);
      } else {
        await axios.post(`${API}/parts`, formData);
      }
      await loadParts(searchTerm);
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült menteni'));
    }
  };

  // Alkatrész törlése
  const handlePartDelete = async (partId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt az alkatrészt?')) return;
    
    try {
      await axios.delete(`${API}/parts/${partId}`);
      await loadParts(searchTerm);
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült törölni'));
    }
  };

  // Készletmozgás
  const handleStockMovement = (partId, movementType) => {
    const part = parts.find(p => p.id === partId);
    setStockModal({ partId, partCode: part.code, movementType });
  };

  const handleStockMovementSubmit = async (partId, movementType, quantity) => {
    try {
      await axios.post(`${API}/stock-movements`, {
        part_id: partId,
        movement_type: movementType,
        quantity: quantity
      });
      setStockModal(null);
      await loadParts(searchTerm);
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült végrehajtani a készletmozgást'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Betöltés...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            {config.logoUrl && (
              <img 
                src={config.logoUrl} 
                alt="Logo" 
                className="h-16 w-16 object-contain rounded-lg shadow-md"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">
                🔧 {config.appName}
              </h1>
              <p className="text-gray-600">
                {config.labels.parts} és raktárkészlet kezelése
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium flex items-center gap-2"
          >
            🏠 {config.labels.backToMain}
          </button>
        </header>

        <QuickAddForm
          partTypes={partTypes}
          suppliers={suppliers}
          onSubmit={handlePartSubmit}
          config={config}
        />

        <SearchBar
          onSearch={handleSearch}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          config={config}
        />

        <div className="mb-4 text-sm text-gray-600">
          Összesen: {parts.length} {config.labels.parts.toLowerCase()}
        </div>

        <PartsTable
          parts={parts}
          onStockMovement={handleStockMovement}
          onEdit={setEditingPart}
          onDelete={handlePartDelete}
          config={config}
        />

        {stockModal && (
          <StockMovementModal
            partId={stockModal.partId}
            partCode={stockModal.partCode}
            movementType={stockModal.movementType}
            onClose={() => setStockModal(null)}
            onSubmit={handleStockMovementSubmit}
            config={config}
          />
        )}
      </div>
    </div>
  );
};

export default TurboInventoryManager;