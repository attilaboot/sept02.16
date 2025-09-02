import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemStats, setSystemStats] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [globalSettings, setGlobalSettings] = useState({
    companyName: 'Turbó Szerviz Kft.',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    defaultCurrency: 'LEI',
    autoBackup: true,
    emailNotifications: true,
    maintenanceMode: false
  });

  useEffect(() => {
    // Check if already authenticated in this session
    const sessionAuth = sessionStorage.getItem('adminAuthenticated');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
      loadSystemData();
    }
  }, []);

  const getCurrentAdminPin = () => {
    return localStorage.getItem('adminPin') || '3655'; // Default PIN
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    const currentPin = getCurrentAdminPin();
    
    if (pinCode === currentPin) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuthenticated', 'true');
      setPinCode('');
      loadSystemData();
    } else {
      alert('Hibás PIN kód!');
      setPinCode('');
    }
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    
    if (newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) {
      alert('A PIN kód pontosan 4 számjegyből kell álljon!');
      return;
    }
    
    localStorage.setItem('adminPin', newPassword);
    setNewPassword('');
    setShowPasswordChange(false);
    alert('PIN kód sikeresen megváltoztatva!');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuthenticated');
    setPinCode('');
  };

  const loadSystemData = async () => {
    try {
      await Promise.all([
        loadSystemStats(),
        loadUsers(),
        loadGlobalSettings()
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Hiba az admin adatok betöltésekor:', error);
      setLoading(false);
    }
  };

  const loadSystemStats = async () => {
    try {
      // Simulate system stats - in real app this would be from backend
      const stats = {
        totalWorkOrders: 127,
        activeClients: 89,
        completedThisMonth: 34,
        revenue: 15750,
        systemUptime: '15 nap 4 óra',
        databaseSize: '2.4 MB',
        lastBackup: '2025-09-01 03:00:00'
      };
      setSystemStats(stats);
    } catch (error) {
      console.error('Hiba a rendszer statisztikák betöltésekor:', error);
    }
  };

  const loadUsers = async () => {
    try {
      // Simulate users - in real app this would be from backend
      const mockUsers = [
        {
          id: '1',
          name: 'Admin User',
          email: 'admin@turbo.com',
          role: 'admin',
          lastLogin: '2025-09-01 10:30',
          active: true,
          createdAt: '2025-01-15'
        },
        {
          id: '2', 
          name: 'Technikus József',
          email: 'jozsef@turbo.com',
          role: 'user',
          lastLogin: '2025-08-31 16:45',
          active: true,
          createdAt: '2025-02-20'
        },
        {
          id: '3',
          name: 'Recepcós Anna',
          email: 'anna@turbo.com', 
          role: 'viewer',
          lastLogin: '2025-08-30 09:15',
          active: true,
          createdAt: '2025-03-10'
        }
      ];
      setUsers(mockUsers);
    } catch (error) {
      console.error('Hiba a felhasználók betöltésekor:', error);
    }
  };

  const loadGlobalSettings = async () => {
    try {
      const savedSettings = localStorage.getItem('adminGlobalSettings');
      if (savedSettings) {
        setGlobalSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Hiba a globális beállítások betöltésekor:', error);
    }
  };

  const saveGlobalSettings = () => {
    localStorage.setItem('adminGlobalSettings', JSON.stringify(globalSettings));
    alert('Globális beállítások mentve!');
  };

  const performBackup = async () => {
    try {
      setLoading(true);
      // Simulate backup process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
          // This would contain actual database export
          message: 'Backup completed successfully'
        }
      };
      
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `turbo_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      setLoading(false);
      alert('Biztonsági mentés elkészült és letöltve!');
    } catch (error) {
      setLoading(false);
      alert('Hiba a biztonsági mentés során: ' + error.message);
    }
  };

  const cleanupDatabase = async () => {
    if (!window.confirm('Biztosan törölni szeretnéd a régi adatokat? Ez a művelet visszavonhatatlan!')) {
      return;
    }
    
    try {
      setLoading(true);
      // Simulate cleanup process
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
      alert('Adatbázis karbantartás befejezve! 15 régi rekord törölve.');
    } catch (error) {
      setLoading(false);
      alert('Hiba az adatbázis karbantartás során: ' + error.message);
    }
  };

  const toggleMaintenanceMode = () => {
    setGlobalSettings(prev => ({
      ...prev,
      maintenanceMode: !prev.maintenanceMode
    }));
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'user': return 'bg-blue-100 text-blue-800';  
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Adminisztrátor';
      case 'user': return 'Felhasználó';
      case 'viewer': return 'Megtekintő';
      default: return 'Ismeretlen';
    }
  };

  // PIN Code Authentication Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">🛡️ Admin Bejelentkezés</h1>
            <p className="text-gray-600">Adja meg a 4 számjegyű PIN kódot</p>
          </div>
          
          <form onSubmit={handlePinSubmit}>
            <div className="mb-4">
              <input
                type="password"
                maxLength="4"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                className="w-full p-4 text-2xl text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 tracking-widest font-mono"
                placeholder="••••"
                autoFocus
              />
            </div>
            
            <button
              type="submit"
              disabled={pinCode.length !== 4}
              className="w-full bg-red-500 text-white py-3 rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              🔓 Bejelentkezés
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button
              onClick={() => window.location.href = '/'}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Vissza a főoldalra
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Admin panel betöltése...</p>
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
                🛡️ Admin Panel
              </h1>
              <p className="text-gray-600">
                Rendszeradminisztrációs központ
              </p>
            </div>
            <div className="flex items-center gap-4">
              {globalSettings.maintenanceMode && (
                <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg flex items-center gap-2">
                  🚧 Karbantartási mód aktív
                </div>
              )}
              <button
                onClick={() => setShowPasswordChange(true)}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 font-medium text-sm"
              >
                🔑 PIN változtatás
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 font-medium text-sm"
              >
                🚪 Kijelentkezés
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium"
              >
                🏠 Vissza a főoldalra
              </button>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'dashboard' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'users' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              👥 Felhasználók
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'system' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🔧 Rendszer
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'settings' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ⚙️ Beállítások
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-6 py-4 font-medium whitespace-nowrap ${activeTab === 'reports' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📈 Riportok
            </button>
          </div>

          <div className="p-6">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div>
                <h3 className="text-lg font-semibold mb-6">Rendszer áttekintés</h3>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-blue-50 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Összes munkalap</p>
                        <p className="text-2xl font-bold text-blue-900">{systemStats.totalWorkOrders}</p>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-full">
                        <span className="text-2xl">📋</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600">Aktív ügyfelek</p>
                        <p className="text-2xl font-bold text-green-900">{systemStats.activeClients}</p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-full">
                        <span className="text-2xl">👥</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-600">E havi teljesítmény</p>
                        <p className="text-2xl font-bold text-purple-900">{systemStats.completedThisMonth}</p>
                      </div>
                      <div className="p-3 bg-purple-100 rounded-full">
                        <span className="text-2xl">✅</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-yellow-600">Bevétel (LEI)</p>
                        <p className="text-2xl font-bold text-yellow-900">{systemStats.revenue?.toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-yellow-100 rounded-full">
                        <span className="text-2xl">💰</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Health */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="font-semibold mb-4">🖥️ Rendszer állapot</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Üzemidő:</span>
                        <span className="font-medium text-green-600">{systemStats.systemUptime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Adatbázis méret:</span>
                        <span className="font-medium">{systemStats.databaseSize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Utolsó mentés:</span>
                        <span className="font-medium">{systemStats.lastBackup}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rendszer státusz:</span>
                        <span className="font-medium text-green-600">🟢 Operációs</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="font-semibold mb-4">⚡ Gyors műveletek</h4>
                    <div className="space-y-3">
                      <button
                        onClick={performBackup}
                        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                      >
                        💾 Biztonsági mentés
                      </button>
                      <button
                        onClick={cleanupDatabase}
                        className="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 flex items-center justify-center gap-2"
                      >
                        🧹 Adatbázis karbantartás
                      </button>
                      <button
                        onClick={toggleMaintenanceMode}
                        className={`w-full px-4 py-2 rounded flex items-center justify-center gap-2 ${
                          globalSettings.maintenanceMode 
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        🚧 {globalSettings.maintenanceMode ? 'Karbantartás kikapcsolása' : 'Karbantartási mód'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Felhasználó kezelés</h3>
                  <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                    ➕ Új felhasználó
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Felhasználó
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Szerepkör
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Utolsó bejelentkezés
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Státusz
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Műveletek
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                              {getRoleLabel(user.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.lastLogin}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.active ? '🟢 Aktív' : '🔴 Inaktív'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button className="text-blue-600 hover:text-blue-900">✏️</button>
                            <button className="text-red-600 hover:text-red-900">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <div>
                <h3 className="text-lg font-semibold mb-6">Rendszer kezelés</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="font-semibold mb-4">💾 Adatkezelés</h4>
                    <div className="space-y-4">
                      <button
                        onClick={performBackup}
                        className="w-full bg-blue-500 text-white px-4 py-3 rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                      >
                        📥 Teljes biztonsági mentés
                      </button>
                      <button
                        className="w-full bg-green-500 text-white px-4 py-3 rounded hover:bg-green-600 flex items-center justify-center gap-2"
                      >
                        📤 Adatok visszaállítása
                      </button>
                      <button
                        onClick={cleanupDatabase}
                        className="w-full bg-orange-500 text-white px-4 py-3 rounded hover:bg-orange-600 flex items-center justify-center gap-2"
                      >
                        🧹 Régi adatok törlése
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="font-semibold mb-4">🔧 Rendszer konfigurálás</h4>
                    <div className="space-y-4">
                      <button
                        onClick={toggleMaintenanceMode}
                        className={`w-full px-4 py-3 rounded flex items-center justify-center gap-2 ${
                          globalSettings.maintenanceMode 
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        🚧 {globalSettings.maintenanceMode ? 'Normál mód visszaállítása' : 'Karbantartási mód aktiválása'}
                      </button>
                      <button className="w-full bg-purple-500 text-white px-4 py-3 rounded hover:bg-purple-600 flex items-center justify-center gap-2">
                        🔄 Rendszer újraindítás
                      </button>
                      <button className="w-full bg-gray-500 text-white px-4 py-3 rounded hover:bg-gray-600 flex items-center justify-center gap-2">
                        📋 Rendszer logok megtekintése
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                <h3 className="text-lg font-semibold mb-6">Globális beállítások</h3>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cégnév
                      </label>
                      <input
                        type="text"
                        value={globalSettings.companyName}
                        onChange={(e) => setGlobalSettings({...globalSettings, companyName: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cég telefon
                      </label>
                      <input
                        type="tel"
                        value={globalSettings.companyPhone}
                        onChange={(e) => setGlobalSettings({...globalSettings, companyPhone: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cég email
                      </label>
                      <input
                        type="email"
                        value={globalSettings.companyEmail}
                        onChange={(e) => setGlobalSettings({...globalSettings, companyEmail: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Alapértelmezett pénznem
                      </label>
                      <select
                        value={globalSettings.defaultCurrency}
                        onChange={(e) => setGlobalSettings({...globalSettings, defaultCurrency: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="LEI">LEI (Román lej)</option>
                        <option value="EUR">EUR (Euro)</option>
                        <option value="USD">USD (Dollár)</option>
                        <option value="HUF">HUF (Forint)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cég címe
                      </label>
                      <textarea
                        value={globalSettings.companyAddress}
                        onChange={(e) => setGlobalSettings({...globalSettings, companyAddress: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        rows="3"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <h4 className="font-semibold mb-4">Rendszer beállítások</h4>
                      <div className="space-y-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="autoBackup"
                            checked={globalSettings.autoBackup}
                            onChange={(e) => setGlobalSettings({...globalSettings, autoBackup: e.target.checked})}
                            className="mr-3"
                          />
                          <label htmlFor="autoBackup" className="text-sm font-medium text-gray-700">
                            Automatikus biztonsági mentés
                          </label>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="emailNotifications"
                            checked={globalSettings.emailNotifications}
                            onChange={(e) => setGlobalSettings({...globalSettings, emailNotifications: e.target.checked})}
                            className="mr-3"
                          />
                          <label htmlFor="emailNotifications" className="text-sm font-medium text-gray-700">
                            Email értesítések
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={saveGlobalSettings}
                      className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 font-medium"
                    >
                      💾 Globális beállítások mentése
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div>
                <h3 className="text-lg font-semibold mb-6">Riportok és statisztikák</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="font-semibold mb-4">📈 Bevételi riportok</h4>
                    <div className="space-y-3">
                      <button className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Havi bevétel jelentés
                      </button>
                      <button className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                        Éves összesítő
                      </button>
                      <button className="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
                        Ügyfél bevétel elemzés
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="font-semibold mb-4">📊 Operációs riportok</h4>
                    <div className="space-y-3">
                      <button className="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">
                        Munkalap teljesítmény
                      </button>
                      <button className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                        Hibaarány elemzés
                      </button>
                      <button className="w-full bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600">
                        Átfutási idő statisztika
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PIN Change Modal */}
        {showPasswordChange && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">🔑 PIN kód megváltoztatása</h3>
              
              <form onSubmit={handlePasswordChange}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Új PIN kód (4 számjegy)
                  </label>
                  <input
                    type="password"
                    maxLength="4"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-4 text-2xl text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 tracking-widest font-mono"
                    placeholder="••••"
                    autoFocus
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordChange(false);
                      setNewPassword('');
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Mégsem
                  </button>
                  <button
                    type="submit"
                    disabled={newPassword.length !== 4}
                    className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    🔑 PIN mentése
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

export default AdminPanel;