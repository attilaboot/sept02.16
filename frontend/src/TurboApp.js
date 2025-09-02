import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";
import WorksheetEditor from "./components/WorksheetEditor";
import AdminPanel from "./components/AdminPanel";
import TurboInventoryManager from "./components/TurboInventoryManager";
import TurboInventorySettings from "./components/TurboInventorySettings";
import DashboardMain from "./components/DashboardMain";
import MainPage from "./components/MainPage";

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Offline Database Manager
class OfflineDB {
  constructor() {
    this.dbName = 'TurboSzervizDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('clients')) {
          const clientStore = db.createObjectStore('clients', { keyPath: 'id' });
          clientStore.createIndex('name', 'name', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('workOrders')) {
          const workOrderStore = db.createObjectStore('workOrders', { keyPath: 'id' });
          workOrderStore.createIndex('work_number', 'work_number', { unique: true });
        }
        
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  async save(storeName, data) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.put(data);
  }

  async get(storeName, id) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, id) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.delete(id);
  }
}

// Global offline database instance
window.offlineDB = new OfflineDB();

// Enhanced API client with offline support
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with offline support
const apiClient = axios.create({
  baseURL: API,
  timeout: 5000
});

// Add response interceptor for offline handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!navigator.onLine || error.code === 'NETWORK_ERROR') {
      // Handle offline mode
      const config = error.config;
      const url = config.url;
      
      if (config.method === 'get') {
        // Try to get data from offline storage
        try {
          let data = [];
          if (url.includes('/clients')) {
            data = await window.offlineDB.getAll('clients');
          } else if (url.includes('/work-orders')) {
            data = await window.offlineDB.getAll('workOrders');
          }
          return Promise.resolve({ data, offline: true });
        } catch (offlineError) {
          return Promise.resolve({ data: [], offline: true });
        }
      }
    }
    return Promise.reject(error);
  }
);

// Enhanced data saving with offline support
const saveToOffline = async (dataType, data) => {
  if (!window.offlineDB.db) {
    await window.offlineDB.init();
  }
  
  const storeName = dataType === 'client' ? 'clients' : 'workOrders';
  await window.offlineDB.save(storeName, { ...data, offline: true, savedAt: new Date().toISOString() });
  
  // Also save to localStorage as backup
  const existingData = JSON.parse(localStorage.getItem(storeName) || '[]');
  const updatedData = existingData.filter(item => item.id !== data.id);
  updatedData.push(data);
  localStorage.setItem(storeName, JSON.stringify(updatedData));
};

// Load offline data
const loadOfflineData = async (dataType) => {
  if (!window.offlineDB.db) {
    await window.offlineDB.init();
  }
  
  const storeName = dataType === 'client' ? 'clients' : 'workOrders';
  try {
    const data = await window.offlineDB.getAll(storeName);
    return data || [];
  } catch (error) {
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem(storeName) || '[]');
  }
};

// Sync offline data when online
const syncOfflineData = async () => {
  if (!navigator.onLine) return;
  
  try {
    const offlineClients = await loadOfflineData('client');
    const offlineWorkOrders = await loadOfflineData('workOrder');
    
    // Sync clients
    for (const client of offlineClients.filter(c => c.offline)) {
      try {
        await axios.post(`${API}/clients`, client);
        // Remove offline flag after successful sync
        client.offline = false;
        await saveToOffline('client', client);
      } catch (error) {
        console.log('Failed to sync client:', client.id);
      }
    }
    
    // Sync work orders
    for (const workOrder of offlineWorkOrders.filter(wo => wo.offline)) {
      try {
        await axios.post(`${API}/work-orders`, workOrder);
        // Remove offline flag after successful sync
        workOrder.offline = false;
        await saveToOffline('workOrder', workOrder);
      } catch (error) {
        console.log('Failed to sync work order:', workOrder.id);
      }
    }
  } catch (error) {
    console.log('Sync failed:', error);
  }
};

// Initialize offline database and sync when online
useEffect(() => {
  const initOfflineDB = async () => {
    try {
      await window.offlineDB.init();
      console.log('Offline database initialized');
      
      // Sync when coming online
      if (navigator.onLine) {
        syncOfflineData();
      }
    } catch (error) {
      console.error('Failed to initialize offline database:', error);
    }
  };
  
  initOfflineDB();
  
  // Listen for online/offline events
  window.addEventListener('online', syncOfflineData);
  window.addEventListener('offline', () => {
    console.log('App is now offline');
  });
  
  return () => {
    window.removeEventListener('online', syncOfflineData);
    window.removeEventListener('offline', () => {});
  };
}, []);

// Application Configuration
const getAppConfig = () => {
  const defaultConfig = {
    appName: "Turbó Szerviz Kezelő",
    logoUrl: "",
    design: {
      primaryColor: "#3B82F6",      // Kék
      secondaryColor: "#10B981",    // Zöld  
      accentColor: "#F59E0B",       // Narancs
      backgroundColor: "#F3F4F6",   // Világos szürke
      textColor: "#1F2937",         // Sötét szürke
      headerFont: "Inter",          // Fejléc font
      bodyFont: "Inter",            // Szöveg font
      fontSize: "16",               // Alapértelmezett font méret (px)
      headerSize: "32",             // Fejléc méret (px)
      borderRadius: "8"             // Lekerekítés (px)
    },
    labels: {
      clients: "Ügyfelek",
      workOrders: "Munkalapok", 
      newWorkOrder: "Új Munkalap",
      parts: "Alkatrészek",
      processes: "Munkafolyamatok",
      settings: "Beállítások",
      dashboard: "Áttekintés",
      search: "Keresés",
      add: "Hozzáadás",
      edit: "Szerkesztés",
      delete: "Törlés",
      save: "Mentés",
      cancel: "Mégsem",
      name: "Név",
      phone: "Telefon",
      address: "Cím",
      company: "Cégnév",
      vehicle: "Jármű",
      turboCode: "Turbó kód",
      status: "Státusz",
      total: "Összeg",
      notes: "Megjegyzések",
      backToMain: "Vissza a főoldalra"
    }
  };

  const savedConfig = localStorage.getItem('turboAppConfig');
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      // Merge with defaults to ensure all properties exist
      return {
        ...defaultConfig,
        ...parsed,
        design: {
          ...defaultConfig.design,
          ...(parsed.design || {})
        },
        labels: {
          ...defaultConfig.labels,
          ...(parsed.labels || {})
        }
      };
    } catch (error) {
      console.error('Error parsing saved config, using defaults:', error);
      return defaultConfig;
    }
  }
  
  return defaultConfig;
};

const saveAppConfig = (config) => {
  localStorage.setItem('turboAppConfig', JSON.stringify(config));
};

// Status translations
const statusTranslations = {
  'DRAFT': 'Vázlat',
  'RECEIVED': 'Beérkezett',
  'IN_PROGRESS': 'Vizsgálat alatt', 
  'QUOTED': 'Árajánlat készült',
  'ACCEPTED': 'Elfogadva',
  'REJECTED': 'Elutasítva',
  'WORKING': 'Javítás alatt',
  'READY': 'Kész',
  'DELIVERED': 'Átvett',
  'FINALIZED': 'Véglegesítve'
};

const statusColors = {
  'DRAFT': 'bg-gray-100 text-gray-800',
  'RECEIVED': 'bg-blue-100 text-blue-800',
  'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
  'QUOTED': 'bg-purple-100 text-purple-800', 
  'ACCEPTED': 'bg-green-100 text-green-800',
  'REJECTED': 'bg-red-100 text-red-800',
  'WORKING': 'bg-orange-100 text-orange-800',
  'READY': 'bg-teal-100 text-teal-800',
  'DELIVERED': 'bg-gray-100 text-gray-800',
  'FINALIZED': 'bg-indigo-100 text-indigo-800'
};

// Dashboard Component  
const Dashboard = () => {
  const [workOrders, setWorkOrders] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    ready: 0,
    delivered: 0
  });
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(getAppConfig());

  // Listen for config changes
  useEffect(() => {
    const handleStorageChange = () => {
      setConfig(getAppConfig());
    };
    
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(() => {
      setConfig(getAppConfig());
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      const response = await axios.get(`${API}/work-orders`);
      const orders = response.data;
      setWorkOrders(orders);
      
      // Calculate stats
      setStats({
        total: orders.length,
        inProgress: orders.filter(o => ['RECEIVED', 'IN_PROGRESS', 'QUOTED', 'ACCEPTED', 'WORKING'].includes(o.status)).length,
        ready: orders.filter(o => o.status === 'READY').length,
        delivered: orders.filter(o => o.status === 'DELIVERED').length
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Hiba a munkalapok betöltésekor:', error);
      setLoading(false);
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
        <header className="mb-8">
          <div className="flex justify-between items-center">
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
                  Teljes körű turbófeltöltő javítás kezelése
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link 
                to="/admin" 
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
              >
                🛡️ ADMIN
              </Link>
              <Link 
                to="/settings" 
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium flex items-center gap-2"
              >
                ⚙️ SETTINGS
              </Link>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white rounded-lg shadow-md p-4 mb-8">
          <div className="flex flex-wrap gap-4">
            <Link to="/main" className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 font-medium">
              🏠 Főmenü
            </Link>
            <Link to="/clients" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-medium">
              👥 Ügyfelek
            </Link>
            <Link to="/work-orders" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium">
              📋 Munkalapok
            </Link>
            <Link to="/new-work-order" className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 font-medium">
              ➕ Új Munkalap
            </Link>
            <Link to="/parts" className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 font-medium">
              🔧 Alkatrészek
            </Link>
            <Link to="/inventory" className="bg-violet-500 text-white px-4 py-2 rounded hover:bg-violet-600 font-medium">
              📦 Raktár
            </Link>
          </div>
        </nav>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 mr-4">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Összes munka</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 mr-4">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Folyamatban</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 mr-4">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Kész</p>
                <p className="text-2xl font-bold text-gray-900">{stats.ready}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-gray-100 mr-4">
                <span className="text-2xl">📦</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Átvett</p>
                <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Work Orders */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Legújabb munkalapok</h2>
            <Link to="/work-orders" className="text-blue-500 hover:text-blue-600 font-medium">
              Összes megtekintése →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Munkalap
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ügyfél
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Turbó kód
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Státusz
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Összeg
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workOrders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{order.work_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <div className="font-medium">{order.client_name}</div>
                        <div className="text-xs text-gray-400">{order.client_phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="font-mono">{order.turbo_code}</div>
                      <div className="text-xs text-gray-400">{order.vehicle_info}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                        {statusTranslations[order.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-bold">{order.total_amount.toFixed(0)} LEI</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {workOrders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Még nincsenek munkalapok</p>
              <Link to="/new-work-order" className="text-blue-500 hover:text-blue-600 font-medium">
                Hozz létre egy újat →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Clients Component
const Clients = () => {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    company_name: '',
    tax_number: '',
    notes: ''
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async (search = '') => {
    try {
      const response = await axios.get(`${API}/clients${search ? `?search=${search}` : ''}`);
      setClients(response.data);
    } catch (error) {
      console.error('Hiba az ügyfelek betöltésekor:', error);
    }
  };

  const handleSearch = () => {
    loadClients(searchTerm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await axios.put(`${API}/clients/${editingClient.id}`, formData);
      } else {
        await axios.post(`${API}/clients`, formData);
      }
      
      setFormData({
        name: '', phone: '', email: '', address: '', 
        company_name: '', tax_number: '', notes: ''
      });
      setShowForm(false);
      setEditingClient(null);
      loadClients(searchTerm);
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült menteni'));
    }
  };

  const handleEdit = (client) => {
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      address: client.address || '',
      company_name: client.company_name || '',
      tax_number: client.tax_number || '',
      notes: client.notes || ''
    });
    setEditingClient(client);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">👥 Ügyfelek</h1>
            <p className="text-gray-600">Ügyfél adatbázis kezelése</p>
          </div>
          <Link to="/" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 font-medium">
            🏠 Vissza
          </Link>
        </div>

        {/* Search & Add Button */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Keresés név, telefon vagy cégnév szerint..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-2 bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
              >
                🔍
              </button>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-medium"
            >
              ➕ Új ügyfél
            </button>
          </div>
        </div>

        {/* Client Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingClient ? 'Ügyfél szerkesztése' : 'Új ügyfél hozzáadása'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Név *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cégnév
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cím
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adószám
                </label>
                <input
                  type="text"
                  value={formData.tax_number}
                  onChange={(e) => setFormData({...formData, tax_number: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Megjegyzések
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium"
                >
                  ✅ Mentés
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingClient(null);
                    setFormData({
                      name: '', phone: '', email: '', address: '', 
                      company_name: '', tax_number: '', notes: ''
                    });
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 font-medium"
                >
                  Mégsem
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Clients Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Név
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kapcsolat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Céginformációk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Műveletek
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{client.name}</div>
                      {client.notes && (
                        <div className="text-xs text-gray-500">{client.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{client.phone}</div>
                      {client.email && <div className="text-xs">{client.email}</div>}
                      {client.address && <div className="text-xs">{client.address}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{client.company_name || '-'}</div>
                      {client.tax_number && <div className="text-xs">{client.tax_number}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(client)}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs"
                      >
                        ✏️ Szerkesztés
                      </button>
                      <Link
                        to={`/new-work-order?client_id=${client.id}`}
                        className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-xs"
                      >
                        📋 Új munka
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {clients.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nincs találat
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Settings Component
const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [config, setConfig] = useState(getAppConfig());
  const [carMakes, setCarMakes] = useState([]);
  const [carModels, setCarModels] = useState([]);
  const [turboNotes, setTurboNotes] = useState([]);
  const [carNotes, setCarNotes] = useState([]);
  const [workProcesses, setWorkProcesses] = useState([]);
  const [turboParts, setTurboParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partCategories, setPartCategories] = useState([
    {id: 1, name: 'C.H.R.A', description: 'Központi forgórész (Center Housing Rotating Assembly)'},
    {id: 2, name: 'GEO', description: 'Geometria (Variable Geometry)'},
    {id: 3, name: 'ACT', description: 'Aktuátor (Actuator)'},
    {id: 4, name: 'SET.GAR', description: 'Javító készlet (Repair Kit)'},
    {id: 5, name: 'HOUSING', description: 'Ház (Turbine/Compressor Housing)'},
    {id: 6, name: 'BEARING', description: 'Csapágy (Bearing Kit)'}
  ]);

  // Form states
  const [showCarMakeForm, setShowCarMakeForm] = useState(false);
  const [showCarModelForm, setShowCarModelForm] = useState(false);
  const [showTurboNoteForm, setShowTurboNoteForm] = useState(false);
  const [showCarNoteForm, setShowCarNoteForm] = useState(false);
  const [selectedMakeForModel, setSelectedMakeForModel] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showProcessForm, setShowProcessForm] = useState(false);

  // Form data
  const [carMakeForm, setCarMakeForm] = useState({ name: '' });
  const [carModelForm, setCarModelForm] = useState({ make_id: '', name: '', engine_codes: '', common_turbos: '' });
  const [turboNoteForm, setTurboNoteForm] = useState({ turbo_code: '', note_type: 'WARNING', title: '', description: '' });
  const [carNoteForm, setCarNoteForm] = useState({ car_make: '', car_model: '', note_type: 'WARNING', title: '', description: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [processForm, setProcessForm] = useState({ name: '', category: '', estimated_time: '', base_price: '', description: '' });

  // Editing states
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingProcess, setEditingProcess] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadCarMakes(),
      loadWorkProcesses(),
      loadTurboParts()
    ]);
    setLoading(false);
  };

  const loadCarMakes = async () => {
    try {
      console.log('Loading car makes...');
      const response = await axios.get(`${API}/car-makes`);
      console.log('Car makes response:', response.data);
      setCarMakes(response.data);
    } catch (error) {
      console.error('Hiba autó márkák betöltésekor:', error);
    }
  };

  const loadCarModels = async (makeId) => {
    try {
      const response = await axios.get(`${API}/car-models/${makeId}`);
      setCarModels(response.data);
    } catch (error) {
      console.error('Hiba autó modellek betöltésekor:', error);
    }
  };

  const loadWorkProcesses = async () => {
    try {
      const response = await axios.get(`${API}/work-processes`);
      setWorkProcesses(response.data);
    } catch (error) {
      console.error('Hiba munkafolyamatok betöltésekor:', error);
    }
  };

  const loadTurboParts = async () => {
    try {
      const response = await axios.get(`${API}/turbo-parts`);
      setTurboParts(response.data);
    } catch (error) {
      console.error('Hiba alkatrészek betöltésekor:', error);
    }
  };

  // Configuration save
  const handleConfigSave = () => {
    saveAppConfig(config);
    alert('Beállítások mentve! Az oldal automatikusan frissül...');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  // Logo upload
  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.includes('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setConfig({...config, logoUrl: e.target.result});
        };
        reader.readAsDataURL(file);
      } else {
        alert('Csak képfájlok engedélyezettek (PNG, JPG, JPEG)');
      }
    }
  };

  // Category management handlers
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        // Update existing category
        setPartCategories(prev => prev.map(cat => 
          cat.id === editingCategory.id 
            ? {...cat, name: categoryForm.name, description: categoryForm.description}
            : cat
        ));
      } else {
        // Add new category
        const newCategory = {
          id: Date.now(), // Simple ID generation
          name: categoryForm.name,
          description: categoryForm.description
        };
        setPartCategories(prev => [...prev, newCategory]);
      }
      
      // Reset form
      setCategoryForm({name: '', description: ''});
      setShowCategoryForm(false);
      setEditingCategory(null);
      
      alert(editingCategory ? 'Kategória frissítve!' : 'Új kategória hozzáadva!');
    } catch (error) {
      alert('Hiba: ' + error.message);
    }
  };

  const handleEditCategory = (category) => {
    setCategoryForm({name: category.name, description: category.description});
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = (categoryId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a kategóriát?')) return;
    
    setPartCategories(prev => prev.filter(cat => cat.id !== categoryId));
    alert('Kategória törölve!');
  };

  const getTurboPartsCountByCategory = (categoryName) => {
    return turboParts.filter(part => part.category === categoryName).length;
  };

  // Process management handlers  
  const handleProcessSubmit = async (e) => {
    e.preventDefault();
    try {
      const processData = {
        name: processForm.name,
        category: processForm.category,
        estimated_time: parseInt(processForm.estimated_time),
        base_price: parseFloat(processForm.base_price),
        description: processForm.description
      };

      if (editingProcess) {
        // Update existing process
        await axios.put(`${API}/work-processes/${editingProcess.id}`, processData);
      } else {
        // Add new process
        await axios.post(`${API}/work-processes`, processData);
      }
      
      // Reset form and reload data
      setProcessForm({name: '', category: '', estimated_time: '', base_price: '', description: ''});
      setShowProcessForm(false);
      setEditingProcess(null);
      loadWorkProcesses();
      
      alert(editingProcess ? 'Munkafolyamat frissítve!' : 'Új munkafolyamat hozzáadva!');
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült menteni'));
    }
  };

  const handleEditProcess = (process) => {
    setProcessForm({
      name: process.name,
      category: process.category,
      estimated_time: process.estimated_time.toString(),
      base_price: process.base_price.toString(),
      description: process.description || ''
    });
    setEditingProcess(process);
    setShowProcessForm(true);
  };

  const handleDeleteProcess = async (processId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a munkafolyamatot?')) return;
    
    try {
      await axios.delete(`${API}/work-processes/${processId}`);
      loadWorkProcesses();
      alert('Munkafolyamat törölve!');
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült törölni'));
    }
  };

  // Car Make functions
  const handleAddCarMake = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/car-makes`, carMakeForm);
      setCarMakeForm({ name: '' });
      setShowCarMakeForm(false);
      loadCarMakes();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült hozzáadni'));
    }
  };

  // Car Model functions
  const handleAddCarModel = async (e) => {
    e.preventDefault();
    try {
      const modelData = {
        make_id: carModelForm.make_id,
        name: carModelForm.name,
        engine_codes: carModelForm.engine_codes.split(',').map(s => s.trim()).filter(s => s),
        common_turbos: carModelForm.common_turbos.split(',').map(s => s.trim()).filter(s => s)
      };
      await axios.post(`${API}/car-models`, modelData);
      setCarModelForm({ make_id: '', name: '', engine_codes: '', common_turbos: '' });
      setShowCarModelForm(false);
      if (selectedMakeForModel) {
        loadCarModels(selectedMakeForModel);
      }
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült hozzáadni'));
    }
  };

  // Turbo Note functions
  const handleAddTurboNote = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/turbo-notes`, turboNoteForm);
      setTurboNoteForm({ turbo_code: '', note_type: 'WARNING', title: '', description: '' });
      setShowTurboNoteForm(false);
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült hozzáadni'));
    }
  };

  // Car Note functions
  const handleAddCarNote = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/car-notes`, carNoteForm);
      setCarNoteForm({ car_make: '', car_model: '', note_type: 'WARNING', title: '', description: '' });
      setShowCarNoteForm(false);
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült hozzáadni'));
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
        <div className="flex justify-between items-center mb-8">
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
              <h1 className="text-4xl font-bold text-gray-800 mb-2">⚙️ SETTINGS</h1>
              <p className="text-gray-600">Rendszer konfigurációk és beállítások</p>
            </div>
          </div>
          <Link to="/" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
            🏠 Vissza a főoldalra
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'general' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🏷️ Általános & Címkék
            </button>
            <button
              onClick={() => setActiveTab('branding')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'branding' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🎨 Logo & Design
            </button>
            <button
              onClick={() => setActiveTab('cars')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'cars' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🚗 Autó adatbázis
            </button>
            <button
              onClick={() => setActiveTab('warnings')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'warnings' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🚨 Figyelmeztetések
            </button>
            <button
              onClick={() => setActiveTab('worksheet')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'worksheet' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📋 Munkalap szerkesztő
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'inventory' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📦 Raktár beállítások
            </button>
            <button
              onClick={() => setActiveTab('parts')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'parts' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🔧 Alkatrészek & Munkák
            </button>
          </div>

          <div className="p-6">
            {/* General & Labels Tab */}
            {activeTab === 'general' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Általános beállítások és címkék</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alkalmazás neve
                    </label>
                    <input
                      type="text"
                      value={config.appName}
                      onChange={(e) => setConfig({...config, appName: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="pl. Turbó Szerviz"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      "Ügyfelek" elnevezés
                    </label>
                    <input
                      type="text"
                      value={config.labels.clients}
                      onChange={(e) => setConfig({...config, labels: {...config.labels, clients: e.target.value}})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="pl. Kliensek, Vásárlók"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      "Munkalapok" elnevezés
                    </label>
                    <input
                      type="text"
                      value={config.labels.workOrders}
                      onChange={(e) => setConfig({...config, labels: {...config.labels, workOrders: e.target.value}})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="pl. Javítások, Megrendelések"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      "Alkatrészek" elnevezés
                    </label>
                    <input
                      type="text"
                      value={config.labels.parts}
                      onChange={(e) => setConfig({...config, labels: {...config.labels, parts: e.target.value}})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="pl. Tartozékok, Komponensek"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleConfigSave}
                    className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 font-medium"
                  >
                    💾 Általános beállítások mentése
                  </button>
                </div>
              </div>
            )}

            {/* Inventory Settings Tab */}
            {activeTab === 'inventory' && (
              <TurboInventorySettings />
            )}

            {/* Worksheet Editor Tab */}
            {activeTab === 'worksheet' && (
              <WorksheetEditor />
            )}

            {/* Logo & Design Tab */}
            {activeTab === 'branding' && (
              <div>
                <h3 className="text-lg font-semibold mb-6">🎨 Logo és Design beállítások</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Logo feltöltés */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3">📷 Logo feltöltés</h4>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        {config.logoUrl ? (
                          <div>
                            <img 
                              src={config.logoUrl} 
                              alt="Current Logo" 
                              className="mx-auto h-32 w-32 object-contain mb-4 rounded-lg shadow-md"
                            />
                            <p className="text-sm text-gray-600 mb-4">Jelenlegi logo</p>
                          </div>
                        ) : (
                          <div className="mb-4">
                            <div className="mx-auto h-32 w-32 bg-gray-200 rounded-lg flex items-center justify-center mb-4">
                              <span className="text-gray-400 text-4xl">🖼️</span>
                            </div>
                            <p className="text-sm text-gray-600">Nincs logo feltöltve</p>
                          </div>
                        )}
                        
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600 font-medium"
                        >
                          📁 Logo kiválasztása
                        </label>
                        
                        {config.logoUrl && (
                          <button
                            onClick={() => setConfig({...config, logoUrl: ''})}
                            className="ml-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 font-medium"
                          >
                            🗑️ Logo törlése
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Színbeállítások */}
                    <div>
                      <h4 className="font-semibold mb-3">🌈 Színbeállítások</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Elsődleges szín</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={config.design.primaryColor}
                              onChange={(e) => setConfig({...config, design: {...config.design, primaryColor: e.target.value}})}
                              className="h-10 w-16 rounded border"
                            />
                            <input
                              type="text"
                              value={config.design.primaryColor}
                              onChange={(e) => setConfig({...config, design: {...config.design, primaryColor: e.target.value}})}
                              className="flex-1 p-2 border border-gray-300 rounded font-mono"
                              placeholder="#3B82F6"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Másodlagos szín</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={config.design.secondaryColor}
                              onChange={(e) => setConfig({...config, design: {...config.design, secondaryColor: e.target.value}})}
                              className="h-10 w-16 rounded border"
                            />
                            <input
                              type="text"
                              value={config.design.secondaryColor}
                              onChange={(e) => setConfig({...config, design: {...config.design, secondaryColor: e.target.value}})}
                              className="flex-1 p-2 border border-gray-300 rounded font-mono"
                              placeholder="#10B981"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Kiemelő szín</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={config.design.accentColor}
                              onChange={(e) => setConfig({...config, design: {...config.design, accentColor: e.target.value}})}
                              className="h-10 w-16 rounded border"
                            />
                            <input
                              type="text"
                              value={config.design.accentColor}
                              onChange={(e) => setConfig({...config, design: {...config.design, accentColor: e.target.value}})}
                              className="flex-1 p-2 border border-gray-300 rounded font-mono"
                              placeholder="#F59E0B"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tipográfia */}
                    <div>
                      <h4 className="font-semibold mb-3">📝 Tipográfia</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Fejléc betűtípus</label>
                          <select
                            value={config.design.headerFont}
                            onChange={(e) => setConfig({...config, design: {...config.design, headerFont: e.target.value}})}
                            className="w-full p-2 border border-gray-300 rounded"
                          >
                            <option value="Inter">Inter (Modern)</option>
                            <option value="Roboto">Roboto (Clean)</option>
                            <option value="Open Sans">Open Sans (Friendly)</option>
                            <option value="Montserrat">Montserrat (Elegant)</option>
                            <option value="Poppins">Poppins (Rounded)</option>
                            <option value="Lato">Lato (Professional)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Szöveg betűtípus</label>
                          <select
                            value={config.design.bodyFont}
                            onChange={(e) => setConfig({...config, design: {...config.design, bodyFont: e.target.value}})}
                            className="w-full p-2 border border-gray-300 rounded"
                          >
                            <option value="Inter">Inter (Modern)</option>
                            <option value="Roboto">Roboto (Clean)</option>
                            <option value="Open Sans">Open Sans (Friendly)</option>
                            <option value="Source Sans Pro">Source Sans Pro (Technical)</option>
                            <option value="Nunito">Nunito (Soft)</option>
                            <option value="System UI">System UI (Native)</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Szöveg méret (px)</label>
                            <input
                              type="number"
                              min="12"
                              max="24"
                              value={config.design.fontSize}
                              onChange={(e) => setConfig({...config, design: {...config.design, fontSize: e.target.value}})}
                              className="w-full p-2 border border-gray-300 rounded"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Fejléc méret (px)</label>
                            <input
                              type="number"
                              min="20"
                              max="48"
                              value={config.design.headerSize}
                              onChange={(e) => setConfig({...config, design: {...config.design, headerSize: e.target.value}})}
                              className="w-full p-2 border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Egyéb beállítások */}
                    <div>
                      <h4 className="font-semibold mb-3">⚙️ Egyéb beállítások</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Lekerekítés (px)</label>
                          <input
                            type="number"
                            min="0"
                            max="24"
                            value={config.design.borderRadius}
                            onChange={(e) => setConfig({...config, design: {...config.design, borderRadius: e.target.value}})}
                            className="w-full p-2 border border-gray-300 rounded"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Háttérszín</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={config.design.backgroundColor}
                              onChange={(e) => setConfig({...config, design: {...config.design, backgroundColor: e.target.value}})}
                              className="h-10 w-16 rounded border"
                            />
                            <input
                              type="text"
                              value={config.design.backgroundColor}
                              onChange={(e) => setConfig({...config, design: {...config.design, backgroundColor: e.target.value}})}
                              className="flex-1 p-2 border border-gray-300 rounded font-mono text-sm"
                              placeholder="#F3F4F6"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Élő előnézet */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3">👁️ Élő előnézet</h4>
                      <div 
                        className="border rounded-lg p-6 shadow-lg transition-all duration-300"
                        style={{
                          backgroundColor: config.design.backgroundColor,
                          borderRadius: `${config.design.borderRadius}px`,
                          fontFamily: config.design.bodyFont,
                          fontSize: `${config.design.fontSize}px`,
                          color: config.design.textColor
                        }}
                      >
                        {/* Header előnézet */}
                        <div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow-sm">
                          {config.logoUrl && (
                            <img 
                              src={config.logoUrl} 
                              alt="Logo Preview" 
                              className="h-16 w-16 object-contain rounded shadow"
                              style={{borderRadius: `${config.design.borderRadius}px`}}
                            />
                          )}
                          <div>
                            <h5 
                              className="font-bold mb-1"
                              style={{
                                fontFamily: config.design.headerFont,
                                fontSize: `${config.design.headerSize}px`,
                                color: config.design.primaryColor
                              }}
                            >
                              🔧 {config.appName}
                            </h5>
                            <p className="text-gray-600" style={{fontSize: `${config.design.fontSize-2}px`}}>
                              Teljes körű turbófeltöltő javítás kezelése
                            </p>
                          </div>
                        </div>

                        {/* Gombok előnézete */}
                        <div className="flex flex-wrap gap-3 mb-6">
                          <button 
                            className="px-4 py-2 text-white font-medium transition-colors"
                            style={{
                              backgroundColor: config.design.primaryColor,
                              borderRadius: `${config.design.borderRadius}px`,
                              fontFamily: config.design.bodyFont
                            }}
                          >
                            👥 Ügyfelek
                          </button>
                          <button 
                            className="px-4 py-2 text-white font-medium transition-colors"
                            style={{
                              backgroundColor: config.design.secondaryColor,
                              borderRadius: `${config.design.borderRadius}px`,
                              fontFamily: config.design.bodyFont
                            }}
                          >
                            📋 Munkalapok
                          </button>
                          <button 
                            className="px-4 py-2 text-white font-medium transition-colors"
                            style={{
                              backgroundColor: config.design.accentColor,
                              borderRadius: `${config.design.borderRadius}px`,
                              fontFamily: config.design.bodyFont
                            }}
                          >
                            ➕ Új Munkalap
                          </button>
                        </div>

                        {/* Példa kártya */}
                        <div 
                          className="bg-white p-4 shadow-sm border"
                          style={{borderRadius: `${config.design.borderRadius}px`}}
                        >
                          <h6 
                            className="font-semibold mb-2"
                            style={{
                              color: config.design.primaryColor,
                              fontFamily: config.design.headerFont,
                              fontSize: `${parseInt(config.design.fontSize) + 2}px`
                            }}
                          >
                            Példa munkalap
                          </h6>
                          <p className="text-gray-600" style={{fontFamily: config.design.bodyFont}}>
                            Turbó kód: 5490-970-0071<br/>
                            Ügyfél: Példa Péter<br/>
                            Státusz: <span style={{color: config.design.secondaryColor}}>Javítás alatt</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Gyors színsémák */}
                    <div>
                      <h4 className="font-semibold mb-3">🎨 Gyors színsémák</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setConfig({...config, design: {...config.design, 
                            primaryColor: "#3B82F6", secondaryColor: "#10B981", accentColor: "#F59E0B"}})}
                          className="p-3 border rounded-lg hover:bg-gray-50 text-left"
                        >
                          <div className="flex gap-2 mb-2">
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#3B82F6"}}></div>
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#10B981"}}></div>
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#F59E0B"}}></div>
                          </div>
                          <div className="text-sm font-medium">Modern Kék</div>
                        </button>

                        <button
                          onClick={() => setConfig({...config, design: {...config.design, 
                            primaryColor: "#EF4444", secondaryColor: "#F97316", accentColor: "#FBBF24"}})}
                          className="p-3 border rounded-lg hover:bg-gray-50 text-left"
                        >
                          <div className="flex gap-2 mb-2">
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#EF4444"}}></div>
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#F97316"}}></div>
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#FBBF24"}}></div>
                          </div>
                          <div className="text-sm font-medium">Energikus Vörös</div>
                        </button>

                        <button
                          onClick={() => setConfig({...config, design: {...config.design, 
                            primaryColor: "#8B5CF6", secondaryColor: "#A855F7", accentColor: "#EC4899"}})}
                          className="p-3 border rounded-lg hover:bg-gray-50 text-left"
                        >
                          <div className="flex gap-2 mb-2">
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#8B5CF6"}}></div>
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#A855F7"}}></div>
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#EC4899"}}></div>
                          </div>
                          <div className="text-sm font-medium">Lila Elegancia</div>
                        </button>

                        <button
                          onClick={() => setConfig({...config, design: {...config.design, 
                            primaryColor: "#374151", secondaryColor: "#6B7280", accentColor: "#9CA3AF"}})}
                          className="p-3 border rounded-lg hover:bg-gray-50 text-left"
                        >
                          <div className="flex gap-2 mb-2">
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#374151"}}></div>
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#6B7280"}}></div>
                            <div className="w-4 h-4 rounded" style={{backgroundColor: "#9CA3AF"}}></div>
                          </div>
                          <div className="text-sm font-medium">Minimál Szürke</div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-4">
                  <button
                    onClick={handleConfigSave}
                    className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 font-medium flex items-center gap-2"
                  >
                    💾 Design beállítások mentése
                  </button>
                  <button
                    onClick={() => setConfig(getAppConfig())}
                    className="bg-gray-500 text-white px-6 py-3 rounded hover:bg-gray-600 font-medium flex items-center gap-2"
                  >
                    🔄 Alapértelmezett visszaállítása
                  </button>
                </div>
              </div>
            )}

            {/* Car Database Tab */}
            {activeTab === 'cars' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">🚗 Autó adatbázis kezelése</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Car Makes */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold">Autó márkák ({carMakes.length})</h4>
                      <button
                        onClick={() => setShowCarMakeForm(true)}
                        className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                      >
                        ➕ Új márka
                      </button>
                    </div>

                    {showCarMakeForm && (
                      <form onSubmit={handleAddCarMake} className="mb-4 p-4 bg-green-50 rounded">
                        <input
                          type="text"
                          placeholder="Márka neve (pl. BMW)"
                          value={carMakeForm.name}
                          onChange={(e) => setCarMakeForm({...carMakeForm, name: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded mb-2"
                          required
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="bg-green-500 text-white px-3 py-1 rounded text-sm">Hozzáadás</button>
                          <button type="button" onClick={() => setShowCarMakeForm(false)} className="bg-gray-500 text-white px-3 py-1 rounded text-sm">Mégsem</button>
                        </div>
                      </form>
                    )}

                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {carMakes.map(make => (
                        <div key={make.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <span className="font-medium">{make.name}</span>
                          <button
                            onClick={() => {
                              setSelectedMakeForModel(make.id);
                              loadCarModels(make.id);
                            }}
                            className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
                          >
                            Modellek
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Car Models */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold">
                        Autó modellek {selectedMakeForModel && `(${carModels.length})`}
                      </h4>
                      {selectedMakeForModel && (
                        <button
                          onClick={() => setShowCarModelForm(true)}
                          className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                        >
                          ➕ Új modell
                        </button>
                      )}
                    </div>

                    {showCarModelForm && (
                      <form onSubmit={handleAddCarModel} className="mb-4 p-4 bg-green-50 rounded space-y-2">
                        <input
                          type="hidden"
                          value={selectedMakeForModel}
                          onChange={(e) => setCarModelForm({...carModelForm, make_id: e.target.value})}
                        />
                        <input
                          type="text"
                          placeholder="Modell neve (pl. X5)"
                          value={carModelForm.name}
                          onChange={(e) => setCarModelForm({...carModelForm, name: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Motorkódok (vesszővel elválasztva)"
                          value={carModelForm.engine_codes}
                          onChange={(e) => setCarModelForm({...carModelForm, engine_codes: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="bg-green-500 text-white px-3 py-1 rounded text-sm">Hozzáadás</button>
                          <button type="button" onClick={() => setShowCarModelForm(false)} className="bg-gray-500 text-white px-3 py-1 rounded text-sm">Mégsem</button>
                        </div>
                      </form>
                    )}

                    {selectedMakeForModel ? (
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {carModels.map(model => (
                          <div key={model.id} className="p-3 bg-gray-50 rounded">
                            <div className="font-medium">{model.name}</div>
                            {model.engine_codes.length > 0 && (
                              <div className="text-xs text-gray-600">
                                Motorok: {model.engine_codes.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-center py-8">
                        Válassz egy márkát a modellek megtekintéséhez
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Warnings Tab */}
            {activeTab === 'warnings' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">🚨 Figyelmeztetési rendszer</h3>
                <p className="text-gray-600 mb-6">Itt hozhatsz létre figyelmeztetéseket turbó kódokhoz és autó típusokhoz. Ezek piros felkiáltójellel jelennek meg a munkalapokban.</p>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Turbo Notes */}
                  <div className="bg-orange-50 p-6 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-orange-800">⚠️ Turbó figyelmeztetések</h4>
                      <button
                        onClick={() => setShowTurboNoteForm(true)}
                        className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
                      >
                        ➕ Új
                      </button>
                    </div>

                    {showTurboNoteForm && (
                      <form onSubmit={handleAddTurboNote} className="mb-4 p-4 bg-white rounded space-y-2">
                        <input
                          type="text"
                          placeholder="Turbó kód (pl. 5490-970-0071)"
                          value={turboNoteForm.turbo_code}
                          onChange={(e) => setTurboNoteForm({...turboNoteForm, turbo_code: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded font-mono"
                          required
                        />
                        <select
                          value={turboNoteForm.note_type}
                          onChange={(e) => setTurboNoteForm({...turboNoteForm, note_type: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                        >
                          <option value="INFO">🔵 INFO</option>
                          <option value="WARNING">🟡 WARNING</option>
                          <option value="CRITICAL">🔴 CRITICAL</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Cím (pl. Gyakori hiba)"
                          value={turboNoteForm.title}
                          onChange={(e) => setTurboNoteForm({...turboNoteForm, title: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                          required
                        />
                        <textarea
                          placeholder="Részletes leírás..."
                          value={turboNoteForm.description}
                          onChange={(e) => setTurboNoteForm({...turboNoteForm, description: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                          rows="3"
                          required
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="bg-orange-500 text-white px-3 py-1 rounded text-sm">Hozzáadás</button>
                          <button type="button" onClick={() => setShowTurboNoteForm(false)} className="bg-gray-500 text-white px-3 py-1 rounded text-sm">Mégsem</button>
                        </div>
                      </form>
                    )}

                    <div className="text-center text-gray-500 py-4">
                      Turbó figyelmeztetések (fejlesztés alatt...)
                    </div>
                  </div>

                  {/* Car Notes */}
                  <div className="bg-red-50 p-6 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-red-800">🚗 Autó figyelmeztetések</h4>
                      <button
                        onClick={() => setShowCarNoteForm(true)}
                        className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                      >
                        ➕ Új
                      </button>
                    </div>

                    {showCarNoteForm && (
                      <form onSubmit={handleAddCarNote} className="mb-4 p-4 bg-white rounded space-y-2">
                        <input
                          type="text"
                          placeholder="Autó márka (pl. BMW)"
                          value={carNoteForm.car_make}
                          onChange={(e) => setCarNoteForm({...carNoteForm, car_make: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Autó modell (pl. X5)"
                          value={carNoteForm.car_model}
                          onChange={(e) => setCarNoteForm({...carNoteForm, car_model: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                          required
                        />
                        <select
                          value={carNoteForm.note_type}
                          onChange={(e) => setCarNoteForm({...carNoteForm, note_type: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                        >
                          <option value="INFO">🔵 INFO</option>
                          <option value="WARNING">🟡 WARNING</option>
                          <option value="CRITICAL">🔴 CRITICAL</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Cím (pl. Gyakori probléma)"
                          value={carNoteForm.title}
                          onChange={(e) => setCarNoteForm({...carNoteForm, title: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                          required
                        />
                        <textarea
                          placeholder="Részletes leírás..."
                          value={carNoteForm.description}
                          onChange={(e) => setCarNoteForm({...carNoteForm, description: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded"
                          rows="3"
                          required
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="bg-red-500 text-white px-3 py-1 rounded text-sm">Hozzáadás</button>
                          <button type="button" onClick={() => setShowCarNoteForm(false)} className="bg-gray-500 text-white px-3 py-1 rounded text-sm">Mégsem</button>
                        </div>
                      </form>
                    )}

                    <div className="text-center text-gray-500 py-4">
                      Autó figyelmeztetések (fejlesztés alatt...)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Parts & Work Processes Tab */}
            {activeTab === 'parts' && (
              <div>
                <h3 className="text-lg font-semibold mb-6">🔧 Alkatrészek és munkafolyamatok</h3>
                
                <div className="space-y-8">
                  {/* Part Categories Management */}
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-blue-800">📦 Alkatrész kategóriák kezelése</h4>
                      <button
                        onClick={() => setShowCategoryForm(!showCategoryForm)}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-medium text-sm"
                      >
                        ➕ Új kategória
                      </button>
                    </div>

                    {showCategoryForm && (
                      <div className="mb-4 p-4 bg-white rounded border-2 border-blue-200">
                        <form onSubmit={handleCategorySubmit} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                              type="text"
                              placeholder="Kategória neve (pl. C.H.R.A)"
                              value={categoryForm.name}
                              onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                              className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              required
                            />
                            <input
                              type="text"
                              placeholder="Leírás (pl. Központi forgórész)"
                              value={categoryForm.description}
                              onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                              className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium"
                            >
                              {editingCategory ? '💾 Mentés' : '➕ Hozzáadás'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowCategoryForm(false);
                                setEditingCategory(null);
                                setCategoryForm({name: '', description: ''});
                              }}
                              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 font-medium"
                            >
                              ❌ Mégsem
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {partCategories.map(category => (
                        <div key={category.id} className="p-4 bg-white rounded shadow border border-blue-200">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-bold text-blue-800">{category.name}</div>
                              <div className="text-sm text-gray-600">{category.description}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {getTurboPartsCountByCategory(category.name)} alkatrész használja
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEditCategory(category)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Szerkesztés"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(category.id)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Törlés"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Work Processes Management */}
                  <div className="bg-green-50 p-6 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-green-800">⚙️ Munkafolyamatok ({workProcesses.length})</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowProcessForm(!showProcessForm)}
                          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium text-sm"
                        >
                          ➕ Új munkafolyamat
                        </button>
                        <Link to="/parts" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-medium text-sm">
                          📝 Részletes szerkesztés
                        </Link>
                      </div>
                    </div>

                    {showProcessForm && (
                      <div className="mb-4 p-4 bg-white rounded border-2 border-green-200">
                        <form onSubmit={handleProcessSubmit} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input
                              type="text"
                              placeholder="Munkafolyamat neve"
                              value={processForm.name}
                              onChange={(e) => setProcessForm({...processForm, name: e.target.value})}
                              className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                              required
                            />
                            <select
                              value={processForm.category}
                              onChange={(e) => setProcessForm({...processForm, category: e.target.value})}
                              className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                              required
                            >
                              <option value="">Válassz kategóriát...</option>
                              <option value="Diagnosis">Diagnosztika</option>
                              <option value="Disassembly">Szétszerelés</option>
                              <option value="Cleaning">Tisztítás</option>
                              <option value="Repair">Javítás</option>
                              <option value="Assembly">Összeszerelés</option>
                              <option value="Testing">Tesztelés</option>
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                placeholder="Idő (perc)"
                                value={processForm.estimated_time}
                                onChange={(e) => setProcessForm({...processForm, estimated_time: e.target.value})}
                                className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                                required
                              />
                              <input
                                type="number"
                                placeholder="Ár (LEI)"
                                value={processForm.base_price}
                                onChange={(e) => setProcessForm({...processForm, base_price: e.target.value})}
                                className="p-3 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                                required
                              />
                            </div>
                          </div>
                          <textarea
                            placeholder="Leírás (opcionális)"
                            value={processForm.description}
                            onChange={(e) => setProcessForm({...processForm, description: e.target.value})}
                            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                            rows="2"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium"
                            >
                              {editingProcess ? '💾 Mentés' : '➕ Hozzáadás'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowProcessForm(false);
                                setEditingProcess(null);
                                setProcessForm({name: '', category: '', estimated_time: '', base_price: '', description: ''});
                              }}
                              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 font-medium"
                            >
                              ❌ Mégsem
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {workProcesses.map(process => (
                        <div key={process.id} className="flex justify-between items-center p-3 bg-white rounded shadow">
                          <div className="flex-1">
                            <div className="font-medium">{process.name}</div>
                            <div className="text-sm text-gray-600">
                              {process.category} • {process.estimated_time} perc • {process.base_price} LEI
                            </div>
                            {process.description && (
                              <div className="text-xs text-gray-500 mt-1">{process.description}</div>
                            )}
                          </div>
                          <div className="flex gap-1 ml-4">
                            <button
                              onClick={() => handleEditProcess(process)}
                              className="text-green-600 hover:text-green-800 p-1"
                              title="Szerkesztés"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteProcess(process.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Törlés"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Statistics */}
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-4">📊 Gyors statisztikák</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="bg-white p-4 rounded shadow">
                        <div className="text-2xl font-bold text-blue-600">{partCategories.length}</div>
                        <div className="text-sm text-gray-600">Kategória</div>
                      </div>
                      <div className="bg-white p-4 rounded shadow">
                        <div className="text-2xl font-bold text-purple-600">{turboParts.length}</div>
                        <div className="text-sm text-gray-600">Alkatrész</div>
                      </div>
                      <div className="bg-white p-4 rounded shadow">
                        <div className="text-2xl font-bold text-green-600">{workProcesses.length}</div>
                        <div className="text-sm text-gray-600">Munkafolyamat</div>
                      </div>
                      <div className="bg-white p-4 rounded shadow">
                        <div className="text-2xl font-bold text-orange-600">
                          {workProcesses.reduce((sum, p) => sum + p.base_price, 0)}
                        </div>
                        <div className="text-sm text-gray-600">Össz munkaár (LEI)</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// WorkOrders Component
const WorkOrders = () => {
  const [workOrders, setWorkOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      const response = await axios.get(`${API}/work-orders`);
      setWorkOrders(response.data);
      setFilteredOrders(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Hiba a munkalapok betöltésekor:', error);
      setLoading(false);
    }
  };

  const handleSearch = () => {
    let filtered = workOrders;

    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.work_number.includes(searchTerm) ||
        order.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.turbo_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.client_phone.includes(searchTerm)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  };

  useEffect(() => {
    handleSearch();
  }, [searchTerm, statusFilter, workOrders]);

  const showOrderDetails = (orderId) => {
    window.location.href = `/work-order-detail?id=${orderId}`;
  };

  const finalizeWorkOrder = async (workOrderId) => {
    if (!window.confirm('Biztosan véglegesíteni szeretnéd ezt a munkalapot? Véglegesítés után nem törölhető!')) {
      return;
    }

    try {
      await axios.post(`${API}/work-orders/${workOrderId}/finalize`);
      alert('Munkalap sikeresen véglegesítve!');
      loadWorkOrders();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült véglegesíteni'));
    }
  };

  const unfinalizeWorkOrder = async (workOrderId) => {
    if (!window.confirm('Biztosan visszavonni szeretnéd a véglegesítést? (Admin funkció)')) {
      return;
    }

    try {
      await axios.post(`${API}/work-orders/${workOrderId}/unfinalize`);
      alert('Véglegesítés visszavonva!');
      loadWorkOrders();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült visszavonni'));
    }
  };

  const deleteWorkOrder = async (workOrderId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a munkalapot? A számozás automatikusan frissül.')) {
      return;
    }

    try {
      await axios.delete(`${API}/work-orders/${workOrderId}`);
      alert('Munkalap törölve és számozás frissítve!');
      loadWorkOrders();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült törölni'));
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await axios.put(`${API}/work-orders/${orderId}`, { status: newStatus });
      loadWorkOrders(); // Reload to get updated data
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült frissíteni'));
    }
  };

  const getStatusBadge = (status) => {
    const statusClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
        {statusTranslations[status] || status}
      </span>
    );
  };

  const getStatusIcon = (status) => {
    const icons = {
      'RECEIVED': '📥',
      'IN_PROGRESS': '🔍', 
      'QUOTED': '💰',
      'ACCEPTED': '✅',
      'REJECTED': '❌',
      'WORKING': '🔧',
      'READY': '🎉',
      'DELIVERED': '📦'
    };
    return icons[status] || '📋';
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">📋 Munkalapok</h1>
            <p className="text-gray-600">Összes turbó javítási munkalap áttekintése</p>
          </div>
          <div className="flex gap-2">
            <Link to="/new-work-order" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium">
              ➕ Új munkalap
            </Link>
            <Link to="/" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 font-medium">
              🏠 Vissza
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          {Object.entries(statusTranslations).map(([status, label]) => {
            const count = workOrders.filter(order => order.status === status).length;
            return (
              <div key={status} className="bg-white rounded-lg shadow-md p-4 text-center">
                <div className="text-2xl mb-2">{getStatusIcon(status)}</div>
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-xs text-gray-600">{label}</div>
              </div>
            );
          })}
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Keresés munkalap szám, ügyfél név, telefon vagy turbó kód szerint..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Összes státusz</option>
                {Object.entries(statusTranslations).map(([status, label]) => (
                  <option key={status} value={status}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Work Orders Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Munkalap
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ügyfél
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Turbó kód
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Státusz
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Összeg
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Beérkezés
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Műveletek
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">#{order.work_number}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('hu-HU')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.client_name}</div>
                      <div className="text-xs text-gray-500">{order.client_phone}</div>
                      {order.vehicle_info && (
                        <div className="text-xs text-gray-400">{order.vehicle_info}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono font-medium text-gray-900">{order.turbo_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(order.status)}
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          {Object.entries(statusTranslations).map(([status, label]) => (
                            <option key={status} value={status}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-green-600">
                        {order.total_amount.toFixed(0)} LEI
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.received_date).toLocaleDateString('hu-HU')}
                      {order.estimated_completion && (
                        <div className="text-xs text-blue-600">
                          Kész: {new Date(order.estimated_completion).toLocaleDateString('hu-HU')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => showOrderDetails(order.id)}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs"
                      >
                        👁️ Részletek
                      </button>
                      <button
                        onClick={() => window.open(`${API}/work-orders/${order.id}/pdf`, '_blank')}
                        className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-xs"
                      >
                        🖨️ Nyomtat
                      </button>
                      
                      {/* Véglegesítés/Törlés gombok */}
                      {!order.is_finalized ? (
                        <>
                          <button
                            onClick={() => finalizeWorkOrder(order.id)}
                            className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-xs"
                            title="Munkalap véglegesítése"
                          >
                            ✅ Véglegesít
                          </button>
                          <button
                            onClick={() => deleteWorkOrder(order.id)}
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs"
                            title="Munkalap törlése"
                          >
                            🗑️ Töröl
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => unfinalizeWorkOrder(order.id)}
                          className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 text-xs"
                          title="Véglegesítés visszavonása (Admin)"
                        >
                          ↩️ Visszavon
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                {workOrders.length === 0 ? (
                  <>
                    <div className="text-6xl mb-4">📋</div>
                    <p className="text-lg">Még nincsenek munkalapok</p>
                    <p className="text-sm">Hozz létre az elsőt!</p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">🔍</div>
                    <p className="text-lg">Nincs találat a keresési feltételeknek</p>
                  </>
                )}
              </div>
              <Link 
                to="/new-work-order" 
                className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-medium"
              >
                ➕ Új munkalap létrehozása
              </Link>
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        {showDetails && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-full overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">
                    Munkalap #{selectedOrder.work_number}
                  </h3>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Client Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-3">👥 Ügyfél információk</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Név:</strong> CORVAST CSABA</div>
                      <div><strong>Telefon:</strong> 0740967539</div>
                      <div><strong>Email:</strong> -</div>
                      <div><strong>Cím:</strong> -</div>
                    </div>
                  </div>

                  {/* Turbo Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-3">🔧 Turbó információk</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Kód:</strong> <span className="font-mono">{selectedOrder.turbo_code}</span></div>
                      <div><strong>Beérkezés:</strong> {new Date(selectedOrder.received_date).toLocaleDateString('hu-HU')}</div>
                      {selectedOrder.estimated_completion && (
                        <div><strong>Becsült kész:</strong> {new Date(selectedOrder.estimated_completion).toLocaleDateString('hu-HU')}</div>
                      )}
                    </div>
                  </div>

                  {/* Parts */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-3">🔧 Kiválasztott alkatrészek</h4>
                    {selectedOrder.parts && selectedOrder.parts.length > 0 ? (
                      <div className="space-y-2">
                        {selectedOrder.parts.filter(p => p.selected).map((part, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <div>
                              <div className="font-medium">{part.category}</div>
                              <div className="font-mono text-xs text-gray-600">{part.part_code}</div>
                              <div className="text-xs text-gray-500">{part.supplier}</div>
                            </div>
                            <div className="font-bold text-blue-600">{part.price.toFixed(0)} LEI</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Nincsenek kiválasztott alkatrészek</p>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-3">💰 Árazás</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Curatat (tisztítás):</span>
                        <span className="font-medium">{selectedOrder.cleaning_price} LEI</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Recond (felújítás):</span>
                        <span className="font-medium">{selectedOrder.reconditioning_price} LEI</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Turbo:</span>
                        <span className="font-medium">{selectedOrder.turbo_price} LEI</span>
                      </div>
                      <hr className="my-2" />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Összesen:</span>
                        <span className="text-green-600">
                          {(selectedOrder.cleaning_price + selectedOrder.reconditioning_price + selectedOrder.turbo_price + 
                           (selectedOrder.parts?.filter(p => p.selected).reduce((sum, p) => sum + p.price, 0) || 0)).toFixed(0)} LEI
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                    <h4 className="font-semibold text-gray-800 mb-3">📋 Státusz és workflow</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className={selectedOrder.status_passed ? 'text-green-600' : 'text-gray-400'}>
                          {selectedOrder.status_passed ? '✅' : '☐'}
                        </span>
                        <span>OK (PASSED)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={selectedOrder.status_refused ? 'text-red-600' : 'text-gray-400'}>
                          {selectedOrder.status_refused ? '❌' : '☐'}
                        </span>
                        <span>REFUZAT</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={selectedOrder.quote_sent ? 'text-purple-600' : 'text-gray-400'}>
                          {selectedOrder.quote_sent ? '📤' : '☐'}
                        </span>
                        <span>OFERTAT</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={selectedOrder.quote_accepted ? 'text-blue-600' : 'text-gray-400'}>
                          {selectedOrder.quote_accepted ? '✅' : '☐'}
                        </span>
                        <span>ACCEPT</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-2">
                  <button
                    onClick={() => setShowDetails(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 font-medium"
                  >
                    Bezárás
                  </button>
                  <button
                    onClick={() => window.open(`/work-orders/${selectedOrder.id}/print`, '_blank')}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-medium"
                  >
                    🖨️ Nyomtatás
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const NewWorkOrder = () => {
  const [clients, setClients] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [turboParts, setTurboParts] = useState([]);
  const [workProcesses, setWorkProcesses] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  
  // New category-based part selection
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoryPartCodes, setCategoryPartCodes] = useState({});
  const [categoryPrices, setCategoryPrices] = useState({});
  const [categoryNotes, setCategoryNotes] = useState({});
  
  const [workOrderData, setWorkOrderData] = useState({
    turbo_code: '',
    car_make: '',          // Autó gyártmány
    car_model: '',         // Autó modell  
    car_year: '',          // Autó évjárat
    engine_code: '',       // Motorkód
    general_notes: '',     // Általános megjegyzések
    parts: [],
    processes: [],         // Munkafolyamatok
    status_passed: false,
    status_refused: false,
    cleaning_price: 0,     // 0 LEI alapérték
    reconditioning_price: 0, // 0 LEI alapérték
    turbo_price: 0,        // 0 LEI alapérték
    quote_sent: false,
    quote_accepted: false,
    estimated_completion: ''
  });
  const [searchClient, setSearchClient] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [carMakes, setCarMakes] = useState([]);
  const [carModels, setCarModels] = useState([]);
  const [filteredCarModels, setFilteredCarModels] = useState([]);
  const [customCarMake, setCustomCarMake] = useState('');
  const [customCarModel, setCustomCarModel] = useState('');
  const [turboWarnings, setTurboWarnings] = useState([]);
  const [carWarnings, setCarWarnings] = useState([]);
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    company_name: ''
  });

  useEffect(() => {
    loadClients();
    loadTurboParts();
    loadWorkProcesses();
    loadCarMakes();
    loadCarModels();
    loadWorkOrders();
  }, []);

  const loadClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Hiba az ügyfelek betöltésekor:', error);
    }
  };

  const loadTurboParts = async () => {
    try {
      const response = await axios.get(`${API}/turbo-parts`);
      setTurboParts(response.data);
    } catch (error) {
      console.error('Hiba az alkatrészek betöltésekor:', error);
    }
  };

  const loadWorkProcesses = async () => {
    try {
      const response = await axios.get(`${API}/work-processes`);
      setWorkProcesses(response.data);
    } catch (error) {
      console.error('Hiba munkafolyamatok betöltésekor:', error);
    }
  };

  const loadCarMakes = async () => {
    try {
      const response = await axios.get(`${API}/car-makes`);
      setCarMakes(response.data);
    } catch (error) {
      console.error('Hiba autó márkák betöltésekor:', error);
    }
  };

  const loadCarModels = async () => {
    try {
      const response = await axios.get(`${API}/car-models`);
      setCarModels(response.data);
    } catch (error) {
      console.error('Hiba autó modellek betöltésekor:', error);
    }
  };

  const loadWorkOrders = async () => {
    try {
      const response = await axios.get(`${API}/work-orders`);
      setWorkOrders(response.data);
    } catch (error) {
      console.error('Hiba munkalapok betöltésekor:', error);
    }
  };

  const handleCarMakeSelect = (selectedMake) => {
    if (selectedMake && selectedMake !== 'OTHER') {
      // Find models from carMakes JSON data
      const carMakesData = [
        {
          "id": "bmw",
          "name": "BMW",
          "models": ["X1", "X3", "X5", "X6", "1 Series", "3 Series", "5 Series", "7 Series", "Z4"]
        },
        {
          "id": "mercedes",
          "name": "Mercedes-Benz", 
          "models": ["A-Class", "B-Class", "C-Class", "E-Class", "S-Class", "GLA", "GLC", "GLE", "GLS"]
        },
        {
          "id": "audi",
          "name": "Audi",
          "models": ["A1", "A3", "A4", "A6", "A8", "Q3", "Q5", "Q7", "TT"]
        },
        {
          "id": "volkswagen", 
          "name": "Volkswagen",
          "models": ["Golf", "Passat", "Polo", "Tiguan", "Touareg", "Arteon", "T-Cross"]
        },
        {
          "id": "ford",
          "name": "Ford",
          "models": ["Fiesta", "Focus", "Mondeo", "Kuga", "Explorer", "Mustang", "Transit"]
        },
        {
          "id": "peugeot",
          "name": "Peugeot", 
          "models": ["208", "308", "508", "2008", "3008", "5008", "Partner"]
        },
        {
          "id": "renault",
          "name": "Renault",
          "models": ["Clio", "Megane", "Scenic", "Kadjar", "Koleos", "Captur", "Twingo"]
        },
        {
          "id": "opel",
          "name": "Opel",
          "models": ["Corsa", "Astra", "Insignia", "Crossland", "Grandland", "Mokka"]
        },
        {
          "id": "citroen",
          "name": "Citroën",
          "models": ["C1", "C3", "C4", "C5", "C3 Aircross", "C5 Aircross", "Berlingo"]
        },
        {
          "id": "skoda",
          "name": "Škoda", 
          "models": ["Fabia", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq"]
        },
        {
          "id": "toyota",
          "name": "Toyota",
          "models": ["Yaris", "Corolla", "Camry", "RAV4", "Highlander", "Prius", "Aygo"]
        },
        {
          "id": "nissan",
          "name": "Nissan", 
          "models": ["Micra", "Qashqai", "X-Trail", "Juke", "Leaf", "Navara"]
        }
      ];
      
      const selectedMakeData = carMakesData.find(make => make.name === selectedMake);
      if (selectedMakeData) {
        // Convert models to the expected format
        const modelsForSelectedMake = selectedMakeData.models.map(model => ({
          make_name: selectedMake,
          name: model
        }));
        setFilteredCarModels(modelsForSelectedMake);
      } else {
        setFilteredCarModels([]);
      }
    } else {
      setFilteredCarModels([]);
    }
  };

  const loadVehicles = async (clientId) => {
    try {
      const response = await axios.get(`${API}/vehicles?client_id=${clientId}`);
      setVehicles(response.data);
    } catch (error) {
      console.error('Hiba a járművek betöltésekor:', error);
    }
  };

  const handleClientSelect = (client) => {
    setSelectedClient(client);
    loadVehicles(client.id);
  };

  const handleAddNewClient = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/clients`, newClient);
      setSelectedClient(response.data);
      setShowNewClientForm(false);
      setNewClient({ name: '', phone: '', email: '', address: '', company_name: '' });
      loadClients();
      loadVehicles(response.data.id);
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült hozzáadni az ügyfelet'));
    }
  };

  const handlePartToggle = (part) => {
    const updatedParts = [...workOrderData.parts];
    const existingIndex = updatedParts.findIndex(p => p.part_id === part.id);
    
    if (existingIndex >= 0) {
      updatedParts[existingIndex].selected = !updatedParts[existingIndex].selected;
    } else {
      updatedParts.push({
        part_id: part.id,
        part_code: part.part_code,
        category: part.category,
        supplier: part.supplier,
        price: part.price,
        selected: true
      });
    }
    
    setWorkOrderData({...workOrderData, parts: updatedParts});
  };

  const isPartSelected = (partId) => {
    const part = workOrderData.parts.find(p => p.part_id === partId);
    return part ? part.selected : false;
  };

  // New category-based handlers
  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handlePartCodeChange = (category, code) => {
    setCategoryPartCodes(prev => ({...prev, [category]: code}));
  };

  const handlePriceChange = (category, price) => {
    setCategoryPrices(prev => ({...prev, [category]: parseFloat(price) || 0}));
  };

  const handleCategoryNoteChange = (category, note) => {
    setCategoryNotes(prev => ({...prev, [category]: note}));
  };

  const isProcessSelected = (processId) => {
    const process = workOrderData.processes.find(p => p.process_id === processId);
    return process ? process.selected : false;
  };

  const handleProcessToggle = (process) => {
    const updatedProcesses = [...workOrderData.processes];
    const existingIndex = updatedProcesses.findIndex(p => p.process_id === process.id);
    
    if (existingIndex >= 0) {
      updatedProcesses[existingIndex].selected = !updatedProcesses[existingIndex].selected;
    } else {
      updatedProcesses.push({
        process_id: process.id,
        process_name: process.name,
        category: process.category,
        estimated_time: process.estimated_time,
        price: process.base_price,
        selected: true,
        notes: ''
      });
    }
    
    setWorkOrderData({...workOrderData, processes: updatedProcesses});
  };

  const getExamplePartCode = (category) => {
    const examples = {
      'C.H.R.A': '1303-090-400',
      'GEO': '5306-016-071-0001', 
      'ACT': '2061-016-006',
      'SET.GAR': 'K7-110690'
    };
    return examples[category] || '0000-000-000';
  };

  const calculateTotal = () => {
    const partsTotal = workOrderData.parts
      .filter(p => p.selected)
      .reduce((sum, p) => sum + p.price, 0);
    
    return workOrderData.cleaning_price + 
           workOrderData.reconditioning_price + 
           workOrderData.turbo_price + 
           partsTotal;
  };

  const handleSubmit = async () => {
    if (!selectedClient || !workOrderData.turbo_code || !workOrderData.car_make || !workOrderData.car_model) {
      alert('Ügyfél, turbó kód, autó márka és autó típus megadása kötelező!');
      return;
    }

    try {
      // Create work order
      const workOrderPayload = {
        client_id: selectedClient.id,
        vehicle_id: selectedVehicle?.id || null,
        turbo_code: workOrderData.turbo_code
      };

      const response = await axios.post(`${API}/work-orders`, workOrderPayload);
      
      // Update with additional data
      const updatePayload = {
        car_make: workOrderData.car_make,
        car_model: workOrderData.car_model,
        car_year: workOrderData.car_year,
        license_plate: workOrderData.license_plate,
        engine_code: workOrderData.engine_code,
        general_notes: workOrderData.general_notes,
        parts: workOrderData.parts,
        processes: workOrderData.processes,
        status_passed: workOrderData.status_passed,
        status_refused: workOrderData.status_refused,
        cleaning_price: workOrderData.cleaning_price,
        reconditioning_price: workOrderData.reconditioning_price,
        turbo_price: workOrderData.turbo_price,
        quote_sent: workOrderData.quote_sent,
        quote_accepted: workOrderData.quote_accepted,
        estimated_completion: workOrderData.estimated_completion || null
      };

      await axios.put(`${API}/work-orders/${response.data.id}`, updatePayload);
      
      alert(`Munkalap sikeresen létrehozva! Sorszám: #${response.data.work_number}`);
      
      // Reset form
      setSelectedClient(null);
      setSelectedVehicle(null);
      setVehicles([]);
      setWorkOrderData({
        turbo_code: '',
        car_make: '',
        car_model: '',
        car_year: '',
        license_plate: '',
        engine_code: '',
        general_notes: '',
        parts: [],
        processes: [],
        status_passed: false,
        status_refused: false,
        cleaning_price: 170,
        reconditioning_price: 170,
        turbo_price: 240,
        quote_sent: false,
        quote_accepted: false,
        estimated_completion: ''
      });
      
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült létrehozni a munkalapot'));
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchClient.toLowerCase()) ||
    client.phone.includes(searchClient)
  );

  const partsByCategory = {
    'C.H.R.A': turboParts.filter(p => p.category === 'C.H.R.A'),
    'GEO': turboParts.filter(p => p.category === 'GEO'),
    'ACT': turboParts.filter(p => p.category === 'ACT'),
    'SET.GAR': turboParts.filter(p => p.category === 'SET.GAR')
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">📋 Új Munkalap</h1>
            <p className="text-gray-600">Turbó javítási munkalap létrehozása</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-2">
              {/* Munkalap száma (következő sorszám előnézet) */}
              <div className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-lg border-2 border-green-700 shadow-md">
                MUNKA-#{(workOrders.length + 1).toString().padStart(5, '0')}
              </div>
              {/* Létrehozás dátuma */}
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-medium">
                📅 {new Date().toLocaleDateString('hu-HU')}
              </div>
            </div>
            <Link to="/" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 font-medium">
              🏠 Vissza
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Client & Vehicle Selection */}
          <div className="space-y-6">
            {/* Client Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">👥 Ügyfél kiválasztása</h3>
              
              {!selectedClient ? (
                <div>
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Keresés név vagy telefon szerint..."
                      value={searchClient}
                      onChange={(e) => setSearchClient(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto mb-4">
                    {filteredClients.map(client => (
                      <div
                        key={client.id}
                        onClick={() => handleClientSelect(client)}
                        className="p-3 border border-gray-200 rounded mb-2 cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                      >
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-gray-600">{client.phone}</div>
                        {client.company_name && (
                          <div className="text-sm text-gray-500">{client.company_name}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowNewClientForm(true)}
                    className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 font-medium"
                  >
                    ➕ Új ügyfél hozzáadása
                  </button>
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-blue-800">{selectedClient.name}</div>
                      <div className="text-blue-600">{selectedClient.phone}</div>
                      {selectedClient.company_name && (
                        <div className="text-blue-600">{selectedClient.company_name}</div>
                      )}
                      {selectedClient.address && (
                        <div className="text-sm text-blue-500">{selectedClient.address}</div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedClient(null);
                        setSelectedVehicle(null);
                        setVehicles([]);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      ❌
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle Selection */}
            {selectedClient && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">🚗 Jármű (opcionális)</h3>
                
                {vehicles.length > 0 ? (
                  <div className="space-y-2">
                    {vehicles.map(vehicle => (
                      <div
                        key={vehicle.id}
                        onClick={() => setSelectedVehicle(vehicle)}
                        className={`p-3 border rounded cursor-pointer ${
                          selectedVehicle?.id === vehicle.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium">
                          {vehicle.make} {vehicle.model} ({vehicle.year})
                        </div>
                        {vehicle.license_plate && (
                          <div className="text-sm text-gray-600">Rendszám: {vehicle.license_plate}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-4">
                    Nincs regisztrált jármű ehhez az ügyfélhez
                  </div>
                )}
              </div>
            )}

            {/* Turbo Code & Car Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">🔧 Turbó és jármű adatok</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Turbó kód *
                  </label>
                  <input
                    type="text"
                    placeholder="pl. 5490-970-0071"
                    value={workOrderData.turbo_code}
                    onChange={(e) => setWorkOrderData({...workOrderData, turbo_code: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono text-lg"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Autó márka *
                    </label>
                    <select
                      value={workOrderData.car_make}
                      onChange={(e) => {
                        setWorkOrderData({...workOrderData, car_make: e.target.value, car_model: ''});
                        handleCarMakeSelect(e.target.value);
                      }}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Válasszon márkát...</option>
                      <option value="BMW">BMW</option>
                      <option value="Mercedes-Benz">Mercedes-Benz</option>
                      <option value="Audi">Audi</option>
                      <option value="Volkswagen">Volkswagen</option>
                      <option value="Ford">Ford</option>
                      <option value="Peugeot">Peugeot</option>
                      <option value="Renault">Renault</option>
                      <option value="Opel">Opel</option>
                      <option value="Citroën">Citroën</option>
                      <option value="Škoda">Škoda</option>
                      <option value="Toyota">Toyota</option>
                      <option value="Nissan">Nissan</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Vagy írjon be egyedi márkát..."
                      className="w-full p-2 border border-gray-300 rounded text-sm mt-2"
                      onBlur={(e) => {
                        if (e.target.value) {
                          setWorkOrderData({...workOrderData, car_make: e.target.value, car_model: ''});
                          handleCarMakeSelect(e.target.value);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Autó típus *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        list="car-models-list"
                        placeholder="pl. X5, A4, C-Class"
                        value={workOrderData.car_model}
                        onChange={(e) => setWorkOrderData({...workOrderData, car_model: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        disabled={!workOrderData.car_make}
                      />
                      <datalist id="car-models-list">
                        {filteredCarModels.map((model, index) => (
                          <option key={index} value={model.name} />
                        ))}
                      </datalist>
                      {!workOrderData.car_make && (
                        <div className="absolute inset-0 bg-gray-50 bg-opacity-75 flex items-center justify-center text-sm text-gray-500 rounded pointer-events-none">
                          Először válassz márkát
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Évjárat
                    </label>
                    <input
                      type="number"
                      placeholder="pl. 2015"
                      value={workOrderData.car_year}
                      onChange={(e) => setWorkOrderData({...workOrderData, car_year: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      min="1990"
                      max="2030"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motorkód
                    </label>
                    <input
                      type="text"
                      placeholder="pl. N47D20"
                      value={workOrderData.engine_code}
                      onChange={(e) => setWorkOrderData({...workOrderData, engine_code: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Általános megjegyzések
                  </label>
                  <textarea
                    placeholder="Ügyfél panaszai, előzmények, egyéb megjegyzések..."
                    value={workOrderData.general_notes}
                    onChange={(e) => setWorkOrderData({...workOrderData, general_notes: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    rows="3"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Parts Selection & Pricing */}
          <div className="space-y-6">
            {/* Parts & Services Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">🔧 Alkatrészek és szolgáltatások</h3>
              
              {/* Category Selection */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-800 mb-3">Szükséges kategóriák kiválasztása</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(partsByCategory).map(category => (
                    <label
                      key={category}
                      className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded border"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={() => handleCategoryToggle(category)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{category}</div>
                        <div className="text-xs text-gray-500">
                          {partsByCategory[category].length} alkatrész elérhető
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Work Processes */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-800 mb-3">Szükséges munkafolyamatok</h4>
                <div className="grid grid-cols-1 gap-2">
                  {workProcesses.map(process => (
                    <label
                      key={process.id}
                      className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded border"
                    >
                      <input
                        type="checkbox"
                        checked={isProcessSelected(process.id)}
                        onChange={() => handleProcessToggle(process)}
                        className="w-4 h-4 text-green-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{process.name}</div>
                        <div className="text-xs text-gray-500">
                          {process.category} • {process.estimated_time} perc • {process.base_price} LEI
                        </div>
                      </div>
                      <div className="font-medium text-green-600">
                        {process.base_price} LEI
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Selected Categories - Part Code Input */}
              {selectedCategories.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800">Alkatrész kódok megadása</h4>
                  {selectedCategories.map(category => (
                    <div key={category} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                      <h5 className="font-medium text-blue-800 mb-3">{category}</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Alkatrész kód
                          </label>
                          <input
                            type="text"
                            placeholder={`pl. ${getExamplePartCode(category)}`}
                            value={categoryPartCodes[category] || ''}
                            onChange={(e) => handlePartCodeChange(category, e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Várható ár (LEI)
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={categoryPrices[category] || ''}
                            onChange={(e) => handlePriceChange(category, e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Megjegyzés
                        </label>
                        <textarea
                          placeholder="Egyedi megjegyzések ehhez a kategóriához..."
                          value={categoryNotes[category] || ''}
                          onChange={(e) => handleCategoryNoteChange(category, e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          rows="2"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">💰 Árazás</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="font-medium">Curatat (tisztítás):</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={workOrderData.cleaning_price}
                      onChange={(e) => setWorkOrderData({...workOrderData, cleaning_price: parseFloat(e.target.value) || 0})}
                      className="w-20 p-2 border border-gray-300 rounded text-right text-sm"
                    />
                    <span className="text-sm">LEI</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <label className="font-medium">Recond (felújítás):</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={workOrderData.reconditioning_price}
                      onChange={(e) => setWorkOrderData({...workOrderData, reconditioning_price: parseFloat(e.target.value) || 0})}
                      className="w-20 p-2 border border-gray-300 rounded text-right text-sm"
                    />
                    <span className="text-sm">LEI</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <label className="font-medium">Turbo:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={workOrderData.turbo_price}
                      onChange={(e) => setWorkOrderData({...workOrderData, turbo_price: parseFloat(e.target.value) || 0})}
                      className="w-20 p-2 border border-gray-300 rounded text-right text-sm"
                    />
                    <span className="text-sm">LEI</span>
                  </div>
                </div>

                <hr className="my-4" />

                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Összesen:</span>
                  <span className="text-blue-600">{calculateTotal().toFixed(0)} LEI</span>
                </div>
              </div>
            </div>

            {/* Status & Workflow */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">📋 Státusz & Workflow</h3>
              
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={workOrderData.status_passed}
                      onChange={(e) => setWorkOrderData({...workOrderData, status_passed: e.target.checked})}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <span className="text-green-700 font-medium">✅ OK (PASSED)</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={workOrderData.status_refused}
                      onChange={(e) => setWorkOrderData({...workOrderData, status_refused: e.target.checked})}
                      className="w-4 h-4 text-red-600 rounded"
                    />
                    <span className="text-red-700 font-medium">❌ REFUZAT</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={workOrderData.quote_sent}
                      onChange={(e) => setWorkOrderData({...workOrderData, quote_sent: e.target.checked})}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-purple-700 font-medium">📤 OFERTAT</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={workOrderData.quote_accepted}
                      onChange={(e) => setWorkOrderData({...workOrderData, quote_accepted: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-blue-700 font-medium">✅ ACCEPT</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    TERMEN ESTIMATIV (kész dátum):
                  </label>
                  <input
                    type="date"
                    value={workOrderData.estimated_completion}
                    onChange={(e) => setWorkOrderData({...workOrderData, estimated_completion: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              className="w-full bg-green-500 text-white py-4 px-6 rounded-lg hover:bg-green-600 font-bold text-lg"
            >
              📋 Munkalap létrehozása
            </button>
          </div>
        </div>

        {/* New Client Form Modal */}
        {showNewClientForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Új ügyfél hozzáadása</h3>
              <form onSubmit={handleAddNewClient}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Név *</label>
                    <input
                      type="text"
                      value={newClient.name}
                      onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon *</label>
                    <input
                      type="tel"
                      value={newClient.phone}
                      onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={newClient.email}
                      onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cégnév</label>
                    <input
                      type="text"
                      value={newClient.company_name}
                      onChange={(e) => setNewClient({...newClient, company_name: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cím</label>
                    <input
                      type="text"
                      value={newClient.address}
                      onChange={(e) => setNewClient({...newClient, address: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-green-500 text-white py-2 rounded hover:bg-green-600 font-medium"
                  >
                    Hozzáadás
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewClientForm(false);
                      setNewClient({ name: '', phone: '', email: '', address: '', company_name: '' });
                    }}
                    className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600 font-medium"
                  >
                    Mégsem
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Parts = () => {
  const [workProcesses, setWorkProcesses] = useState([]);
  const [turboParts, setTurboParts] = useState([]);
  const [activeTab, setActiveTab] = useState('processes');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Work Process Form Data
  const [processFormData, setProcessFormData] = useState({
    name: '',
    category: '',
    estimated_time: 0,
    base_price: 0
  });

  // Turbo Part Form Data  
  const [partFormData, setPartFormData] = useState({
    category: '',
    part_code: '',
    supplier: '',
    price: 0
  });

  const processCategories = [
    'Diagnosis', 'Cleaning', 'Assembly', 'Testing', 'Repair', 'Maintenance'
  ];

  const partCategories = [
    'C.H.R.A', 'GEO', 'ACT', 'SET.GAR'
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadWorkProcesses(), loadTurboParts()]);
    setLoading(false);
  };

  const loadWorkProcesses = async () => {
    try {
      const response = await axios.get(`${API}/work-processes`);
      setWorkProcesses(response.data);
    } catch (error) {
      console.error('Hiba a munkafolyamatok betöltésekor:', error);
    }
  };

  const loadTurboParts = async () => {
    try {
      const response = await axios.get(`${API}/turbo-parts`);
      setTurboParts(response.data);
    } catch (error) {
      console.error('Hiba az alkatrészek betöltésekor:', error);
    }
  };

  // Work Process Handlers
  const handleProcessSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem && activeTab === 'processes') {
        await axios.put(`${API}/work-processes/${editingItem.id}`, processFormData);
      } else {
        await axios.post(`${API}/work-processes`, processFormData);
      }
      
      setProcessFormData({ name: '', category: '', estimated_time: 0, base_price: 0 });
      setShowForm(false);
      setEditingItem(null);
      loadWorkProcesses();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült menteni'));
    }
  };

  const handleProcessEdit = (process) => {
    setProcessFormData({
      name: process.name,
      category: process.category,
      estimated_time: process.estimated_time,
      base_price: process.base_price
    });
    setEditingItem(process);
    setShowForm(true);
  };

  const handleProcessDelete = async (processId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a munkafolyamatot?')) return;
    
    try {
      await axios.delete(`${API}/work-processes/${processId}`);
      loadWorkProcesses();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült törölni'));
    }
  };

  // Turbo Part Handlers
  const handlePartSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem && activeTab === 'parts') {
        await axios.put(`${API}/turbo-parts/${editingItem.id}`, partFormData);
      } else {
        await axios.post(`${API}/turbo-parts`, partFormData);
      }
      
      setPartFormData({ category: '', part_code: '', supplier: '', price: 0 });
      setShowForm(false);
      setEditingItem(null);
      loadTurboParts();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült menteni'));
    }
  };

  const handlePartEdit = (part) => {
    setPartFormData({
      category: part.category,
      part_code: part.part_code,
      supplier: part.supplier,
      price: part.price
    });
    setEditingItem(part);
    setShowForm(true);
  };

  const handlePartDelete = async (partId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt az alkatrészt?')) return;
    
    try {
      await axios.delete(`${API}/turbo-parts/${partId}`);
      loadTurboParts();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült törölni'));
    }
  };

  const filteredProcesses = workProcesses.filter(process =>
    process.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    process.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredParts = turboParts.filter(part =>
    part.part_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">🔧 Alkatrészek & Munkák</h1>
            <p className="text-gray-600">Munkafolyamatok és alkatrészek adatbázisa</p>
          </div>
          <Link to="/" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 font-medium">
            🏠 Vissza
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => {
                setActiveTab('processes');
                setShowForm(false);
                setEditingItem(null);
              }}
              className={`px-6 py-4 font-medium ${activeTab === 'processes' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ⚙️ Munkafolyamatok ({workProcesses.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('parts');
                setShowForm(false);
                setEditingItem(null);
              }}
              className={`px-6 py-4 font-medium ${activeTab === 'parts' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🔧 Turbó alkatrészek ({turboParts.length})
            </button>
          </div>
        </div>

        {/* Search & Add Button */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={`Keresés ${activeTab === 'processes' ? 'munkafolyamatok' : 'alkatrészek'} között...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-3 text-gray-400">🔍</span>
            </div>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingItem(null);
                if (activeTab === 'processes') {
                  setProcessFormData({ name: '', category: '', estimated_time: 0, base_price: 0 });
                } else {
                  setPartFormData({ category: '', part_code: '', supplier: '', price: 0 });
                }
              }}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-medium"
            >
              ➕ Új {activeTab === 'processes' ? 'munkafolyamat' : 'alkatrész'}
            </button>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {editingItem ? 'Szerkesztés' : 'Új hozzáadása'} - {activeTab === 'processes' ? 'Munkafolyamat' : 'Alkatrész'}
                </h3>

                {activeTab === 'processes' ? (
                  <form onSubmit={handleProcessSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Munkafolyamat neve *
                        </label>
                        <input
                          type="text"
                          value={processFormData.name}
                          onChange={(e) => setProcessFormData({...processFormData, name: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="pl. Szétszerelés, Tisztítás, Diagnosztika"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kategória *
                        </label>
                        <select
                          value={processFormData.category}
                          onChange={(e) => setProcessFormData({...processFormData, category: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Válassz kategóriát...</option>
                          {processCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Becsült idő (perc)
                        </label>
                        <input
                          type="number"
                          value={processFormData.estimated_time}
                          onChange={(e) => setProcessFormData({...processFormData, estimated_time: parseInt(e.target.value) || 0})}
                          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Alapár (LEI)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={processFormData.base_price}
                          onChange={(e) => setProcessFormData({...processFormData, base_price: parseFloat(e.target.value) || 0})}
                          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                      <button
                        type="submit"
                        className="flex-1 bg-green-500 text-white py-2 rounded hover:bg-green-600 font-medium"
                      >
                        {editingItem ? 'Frissítés' : 'Hozzáadás'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setEditingItem(null);
                        }}
                        className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600 font-medium"
                      >
                        Mégsem
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handlePartSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kategória *
                        </label>
                        <select
                          value={partFormData.category}
                          onChange={(e) => setPartFormData({...partFormData, category: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Válassz kategóriát...</option>
                          {partCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Alkatrész kód *
                        </label>
                        <input
                          type="text"
                          value={partFormData.part_code}
                          onChange={(e) => setPartFormData({...partFormData, part_code: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="pl. 1303-090-400"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Beszállító *
                        </label>
                        <input
                          type="text"
                          value={partFormData.supplier}
                          onChange={(e) => setPartFormData({...partFormData, supplier: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="pl. Melett, Vallion, Cer"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ár (LEI)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={partFormData.price}
                          onChange={(e) => setPartFormData({...partFormData, price: parseFloat(e.target.value) || 0})}
                          className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                      <button
                        type="submit"
                        className="flex-1 bg-green-500 text-white py-2 rounded hover:bg-green-600 font-medium"
                      >
                        {editingItem ? 'Frissítés' : 'Hozzáadás'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setEditingItem(null);
                        }}
                        className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600 font-medium"
                      >
                        Mégsem
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {activeTab === 'processes' ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Munkafolyamat
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kategória
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Becsült idő
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Alapár
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Műveletek
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProcesses.map((process) => (
                    <tr key={process.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{process.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {process.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {process.estimated_time > 0 ? `${process.estimated_time} perc` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {process.base_price > 0 ? `${process.base_price} LEI` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleProcessEdit(process)}
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs"
                        >
                          ✏️ Szerkesztés
                        </button>
                        <button
                          onClick={() => handleProcessDelete(process.id)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs"
                        >
                          🗑️ Törlés
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredProcesses.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  <div className="text-6xl mb-4">⚙️</div>
                  <p className="text-lg">Még nincsenek munkafolyamatok</p>
                </div>
                <button 
                  onClick={() => setShowForm(true)}
                  className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-medium"
                >
                  ➕ Első munkafolyamat hozzáadása
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kategória
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Alkatrész kód
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Beszállító
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ár
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Műveletek
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredParts.map((part) => (
                    <tr key={part.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {part.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-medium text-gray-900">{part.part_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {part.supplier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {part.price} LEI
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handlePartEdit(part)}
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs"
                        >
                          ✏️ Szerkesztés
                        </button>
                        <button
                          onClick={() => handlePartDelete(part.id)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs"
                        >
                          🗑️ Törlés
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredParts.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  <div className="text-6xl mb-4">🔧</div>
                  <p className="text-lg">Még nincsenek turbó alkatrészek</p>
                </div>
                <button 
                  onClick={() => setShowForm(true)}
                  className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-medium"
                >
                  ➕ Első alkatrész hozzáadása
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// WorkOrder Detail Component
const WorkOrderDetail = () => {
  const [workOrder, setWorkOrder] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  
  // Mocked workOrderId - in real app this would come from URL params
  const workOrderId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    loadWorkOrderDetail();
  }, [workOrderId]);

  const loadWorkOrderDetail = async () => {
    if (!workOrderId) return;
    
    try {
      // Load work order
      const orderResponse = await axios.get(`${API}/work-orders/${workOrderId}`);
      const orderData = orderResponse.data;
      setWorkOrder(orderData);
      
      // Load client
      const clientResponse = await axios.get(`${API}/clients/${orderData.client_id}`);
      setClient(clientResponse.data);
      
      setLoading(false);
    } catch (error) {
      console.error('Hiba a munkalap betöltésekor:', error);
      setLoading(false);
    }
  };

  const handlePrintHTML = () => {
    window.print();
  };

  const handlePrintPDF = () => {
    if (workOrder) {
      window.open(`${API}/work-orders/${workOrder.id}/pdf`, '_blank');
    }
  };

  const getStatusColor = (status) => {
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Munkalap betöltése...</p>
        </div>
      </div>
    );
  }

  if (!workOrder || !client) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Munkalap nem található</h2>
          <Link to="/work-orders" className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600">
            ← Vissza a munkalapokhoz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Actions */}
        <div className="flex justify-between items-center mb-8 print:hidden">
          <div className="flex items-center gap-4">
            <Link to="/work-orders" className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
              ← Vissza a főoldalra
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Munkalap #{workOrder.work_number}</h1>
              <p className="text-gray-600">Részletes információk</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowPrintOptions(!showPrintOptions)}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium"
            >
              🖨️ Nyomtatás
            </button>
            <Link 
              to={`/edit-work-order?id=${workOrder.id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
            >
              ✏️ Szerkesztés
            </Link>
          </div>
        </div>

        {/* Print Options */}
        {showPrintOptions && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-md print:hidden">
            <h3 className="font-semibold mb-3">Nyomtatási opciók:</h3>
            <div className="flex gap-4">
              <button
                onClick={handlePrintHTML}
                className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 font-medium flex items-center gap-2"
              >
                🖨️ HTML Nyomtatás
              </button>
              <button
                onClick={() => window.open(`${API}/work-orders/${workOrder.id}/html`, '_blank')}
                className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 font-medium flex items-center gap-2"
              >
                🌐 HTML Nyomtatás
              </button>
              <button
                onClick={handlePrintPDF}
                className="bg-red-500 text-white px-6 py-3 rounded hover:bg-red-600 font-medium flex items-center gap-2"
              >
                📄 PDF Letöltés
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              HTML nyomtatás: Böngésző nyomtatás funkciója | PDF letöltés: Formázott PDF fájl
            </p>
          </div>
        )}

        {/* Work Order Content */}
        <div className="bg-white rounded-lg shadow-md p-8 print:shadow-none print:rounded-none relative">
          {/* Munkalap száma és dátuma (bal felső sarok) */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-lg border-2 border-blue-700 shadow-md">
              MUNKA-#{workOrder.work_number}
            </div>
            <div className="bg-green-500 text-white px-3 py-1 rounded text-sm font-medium">
              📅 {new Date(workOrder.created_at).toLocaleDateString('hu-HU')}
            </div>
          </div>

          {/* Print Header */}
          <div className="hidden print:block text-center mb-6 border-b-2 border-gray-800 pb-4">
            <h1 className="text-2xl font-bold mb-2">🔧 TURBÓ SZERVIZ</h1>
            <p className="text-gray-600">Turbófeltöltő javítás és karbantartás</p>
            <div className="text-xl font-bold mt-2">MUNKALAP #{workOrder.work_number}</div>
          </div>

          {/* Client and Vehicle Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold border-b pb-2 mb-4">👤 Ügyfél adatok</h3>
              <div className="space-y-2">
                <p><strong>Név:</strong> {client.name}</p>
                <p><strong>Telefon:</strong> {client.phone}</p>
                {client.email && <p><strong>Email:</strong> {client.email}</p>}
                {client.address && <p><strong>Cím:</strong> {client.address}</p>}
                {client.company_name && <p><strong>Cégnév:</strong> {client.company_name}</p>}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold border-b pb-2 mb-4">🚗 Jármű adatok</h3>
              <div className="space-y-2">
                <p><strong>Márka:</strong> {workOrder.car_make}</p>
                <p><strong>Típus:</strong> {workOrder.car_model}</p>
                {workOrder.car_year && <p><strong>Évjárat:</strong> {workOrder.car_year}</p>}
                {workOrder.engine_code && <p><strong>Motorkód:</strong> {workOrder.engine_code}</p>}
              </div>
            </div>
          </div>

          {/* Turbo Info */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">🔧 Turbó információk</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <p><strong>Turbó kód:</strong> {workOrder.turbo_code}</p>
              <p><strong>Beérkezés dátuma:</strong> {workOrder.received_date}</p>
            </div>
            {workOrder.general_notes && (
              <div className="mt-4">
                <p><strong>Megjegyzések:</strong></p>
                <div className="bg-gray-50 p-3 rounded mt-2">
                  {workOrder.general_notes}
                </div>
              </div>
            )}
          </div>

          {/* Parts */}
          {workOrder.parts && workOrder.parts.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold border-b pb-2 mb-4">🔩 Kiválasztott alkatrészek</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alkatrész kód</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategória</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Szállító</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ár (LEI)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kiválasztva</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {workOrder.parts.map((part, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{part.part_code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{part.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{part.supplier}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{part.price.toLocaleString('ro-RO')} LEI</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {part.selected ? (
                            <span className="text-green-600 font-bold">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Work Processes */}
          {workOrder.processes && workOrder.processes.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold border-b pb-2 mb-4">⚙️ Munkafolyamatok</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Folyamat</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategória</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Idő (perc)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ár (LEI)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kiválasztva</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {workOrder.processes.map((process, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{process.process_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{process.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{process.estimated_time}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{process.price.toLocaleString('ro-RO')} LEI</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {process.selected ? (
                            <span className="text-green-600 font-bold">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status and Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold border-b pb-2 mb-4">📊 Státusz információk</h3>
              <div className="space-y-3">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(workOrder.status)}`}>
                    {statusTranslations[workOrder.status] || workOrder.status}
                  </span>
                </div>
                <p><strong>Árajánlat küldve:</strong> {workOrder.quote_sent ? 'Igen' : 'Nem'}</p>
                <p><strong>Árajánlat elfogadva:</strong> {workOrder.quote_accepted ? 'Igen' : 'Nem'}</p>
                {workOrder.estimated_completion && (
                  <p><strong>Becsült készre kerülés:</strong> {workOrder.estimated_completion}</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold border-b pb-2 mb-4">💰 Árazás</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Tisztítás:</span>
                    <span>{workOrder.cleaning_price.toLocaleString('ro-RO')} LEI</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Felújítás:</span>
                    <span>{workOrder.reconditioning_price.toLocaleString('ro-RO')} LEI</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Turbó:</span>
                    <span>{workOrder.turbo_price.toLocaleString('ro-RO')} LEI</span>
                  </div>
                  <hr className="my-3" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Összesen:</span>
                    <span>{(workOrder.cleaning_price + workOrder.reconditioning_price + workOrder.turbo_price).toLocaleString('ro-RO')} LEI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 pt-6 border-t text-sm text-gray-500">
            <p>Létrehozva: {new Date(workOrder.created_at).toLocaleString('hu-HU')}</p>
            <p>Utoljára frissítve: {new Date(workOrder.updated_at).toLocaleString('hu-HU')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};


// Main App Component
function TurboApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workspace" element={<MainPage />} />
        <Route path="/main" element={<MainPage />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/work-orders" element={<WorkOrders />} />
        <Route path="/work-order-detail" element={<WorkOrderDetail />} />
        <Route path="/new-work-order" element={<NewWorkOrder />} />
        <Route path="/parts" element={<Parts />} />
        <Route path="/inventory" element={<TurboInventoryManager />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default TurboApp;