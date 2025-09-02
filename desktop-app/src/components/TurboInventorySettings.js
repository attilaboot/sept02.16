import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

const TurboInventorySettings = () => {
  const [activeTab, setActiveTab] = useState('types');
  const [partTypes, setPartTypes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [editingType, setEditingType] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(getAppConfig());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await loadPartTypes();
    await loadSuppliers();
    setLoading(false);
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

  // Configuration save function
  const handleConfigSave = () => {
    saveAppConfig(config);
    alert('Beállítások mentve! Az oldal automatikusan frissül...');
    // Force immediate update and navigate back
    setTimeout(() => {
      window.location.href = '/inventory';
    }, 1000);
  };

  // Logo upload handler
  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.includes('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setConfig({
            ...config,
            logoUrl: e.target.result
          });
        };
        reader.readAsDataURL(file);
      } else {
        alert('Kérlek, csak kép fájlokat (PNG, JPG) válassz!');
      }
    }
  };

  // Part Types műveletek
  const handleAddType = async (e) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    
    try {
      await axios.post(`${API}/part-types`, { name: newTypeName });
      setNewTypeName('');
      loadPartTypes();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült hozzáadni'));
    }
  };

  const handleUpdateType = async (id, name) => {
    try {
      await axios.put(`${API}/part-types/${id}`, { name });
      setEditingType(null);
      loadPartTypes();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült frissíteni'));
    }
  };

  const handleDeleteType = async (id) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt az alkatrésztípust?')) return;
    
    try {
      await axios.delete(`${API}/part-types/${id}`);
      loadPartTypes();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült törölni'));
    }
  };

  // Suppliers műveletek
  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    
    try {
      await axios.post(`${API}/suppliers`, { name: newSupplierName });
      setNewSupplierName('');
      loadSuppliers();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült hozzáadni'));
    }
  };

  const handleUpdateSupplier = async (id, name) => {
    try {
      await axios.put(`${API}/suppliers/${id}`, { name });
      setEditingSupplier(null);
      loadSuppliers();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült frissíteni'));
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a beszállítót?')) return;
    
    try {
      await axios.delete(`${API}/suppliers/${id}`);
      loadSuppliers();
    } catch (error) {
      alert('Hiba: ' + (error.response?.data?.detail || 'Nem sikerült törölni'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Betöltés...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">📦 Raktár beállítások (GitHub verzió)</h3>
          <p className="text-gray-600">Alkatrésztípusok, beszállítók és beállítások kezelése</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('types')}
            className={`px-6 py-4 font-medium ${activeTab === 'types' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            📦 {config.labels.partTypes} {config.labels.management}
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-6 py-4 font-medium ${activeTab === 'suppliers' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🏢 {config.labels.suppliers} {config.labels.management}
          </button>
          <button
            onClick={() => setActiveTab('labels')}
            className={`px-6 py-4 font-medium ${activeTab === 'labels' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🏷️ Megnevezések
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`px-6 py-4 font-medium ${activeTab === 'branding' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🎨 Logo & Design
          </button>
        </div>

        <div className="p-6">
          {/* Alkatrésztípusok Tab */}
          {activeTab === 'types' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">{config.labels.partTypes} {config.labels.management}</h3>
              
              <form onSubmit={handleAddType} className="mb-6 flex gap-2">
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder={`Új ${config.labels.partTypes.toLowerCase()} neve...`}
                  className="flex-1 p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 font-medium"
                >
                  ➕ {config.labels.add}
                </button>
              </form>
              
              <div className="space-y-2">
                {partTypes.map(type => (
                  <div key={type.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    {editingType === type.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          defaultValue={type.name}
                          className="flex-1 p-2 border border-gray-300 rounded"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateType(type.id, e.target.value);
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            const input = e.target.parentElement.querySelector('input');
                            handleUpdateType(type.id, input.value);
                          }}
                          className="bg-green-500 text-white px-3 py-2 rounded text-sm font-medium"
                        >
                          ✅ {config.labels.save}
                        </button>
                        <button
                          onClick={() => setEditingType(null)}
                          className="bg-gray-500 text-white px-3 py-2 rounded text-sm font-medium"
                        >
                          ❌ {config.labels.cancel}
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">{type.name}</span>
                        <div className="space-x-2">
                          <button
                            onClick={() => setEditingType(type.id)}
                            className="bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-600"
                          >
                            ✏️ {config.labels.edit}
                          </button>
                          <button
                            onClick={() => handleDeleteType(type.id)}
                            className="bg-red-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-600"
                          >
                            🗑️ {config.labels.delete}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Beszállítók Tab */}
          {activeTab === 'suppliers' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">{config.labels.suppliers} {config.labels.management}</h3>
              
              <form onSubmit={handleAddSupplier} className="mb-6 flex gap-2">
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder={`Új ${config.labels.supplier.toLowerCase()} neve...`}
                  className="flex-1 p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 font-medium"
                >
                  ➕ {config.labels.add}
                </button>
              </form>
              
              <div className="space-y-2">
                {suppliers.map(supplier => (
                  <div key={supplier.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    {editingSupplier === supplier.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          defaultValue={supplier.name}
                          className="flex-1 p-2 border border-gray-300 rounded"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateSupplier(supplier.id, e.target.value);
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            const input = e.target.parentElement.querySelector('input');
                            handleUpdateSupplier(supplier.id, input.value);
                          }}
                          className="bg-green-500 text-white px-3 py-2 rounded text-sm font-medium"
                        >
                          ✅ {config.labels.save}
                        </button>
                        <button
                          onClick={() => setEditingSupplier(null)}
                          className="bg-gray-500 text-white px-3 py-2 rounded text-sm font-medium"
                        >
                          ❌ {config.labels.cancel}
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">{supplier.name}</span>
                        <div className="space-x-2">
                          <button
                            onClick={() => setEditingSupplier(supplier.id)}
                            className="bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-600"
                          >
                            ✏️ {config.labels.edit}
                          </button>
                          <button
                            onClick={() => handleDeleteSupplier(supplier.id)}
                            className="bg-red-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-600"
                          >
                            🗑️ {config.labels.delete}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Megnevezések Tab */}
          {activeTab === 'labels' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Megnevezések testreszabása</h3>
              <p className="text-gray-600 mb-6">Itt változtathatod meg az alkalmazás szöveges elemeit a saját igényeid szerint.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alkalmazás neve
                  </label>
                  <input
                    type="text"
                    value={config.appName}
                    onChange={(e) => setConfig({...config, appName: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="pl. Alkatrész Kezelő"
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
                    placeholder="pl. Termékek, Cikkek, Elemek"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    "Alkatrésztípusok" elnevezés
                  </label>
                  <input
                    type="text"
                    value={config.labels.partTypes}
                    onChange={(e) => setConfig({...config, labels: {...config.labels, partTypes: e.target.value}})}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="pl. Kategóriák, Típusok"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    "Beszállítók" elnevezés
                  </label>
                  <input
                    type="text"
                    value={config.labels.suppliers}
                    onChange={(e) => setConfig({...config, labels: {...config.labels, suppliers: e.target.value}})}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="pl. Szállítók, Partnerek"
                  />
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleConfigSave}
                  className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 font-medium"
                >
                  💾 Megnevezések mentése
                </button>
              </div>
            </div>
          )}

          {/* Logo & Design Tab */}
          {activeTab === 'branding' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Logo és Design</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div>
                  <h4 className="font-semibold mb-3">🎨 Design előnézet</h4>
                  <div className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center gap-3 mb-4">
                      {config.logoUrl && (
                        <img 
                          src={config.logoUrl} 
                          alt="Logo Preview" 
                          className="h-12 w-12 object-contain rounded shadow"
                        />
                      )}
                      <div>
                        <h5 className="text-xl font-bold text-gray-800">🔧 {config.appName}</h5>
                        <p className="text-gray-600 text-sm">{config.labels.parts} és raktárkészlet kezelése</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleConfigSave}
                  className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 font-medium"
                >
                  💾 Design beállítások mentése
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TurboInventorySettings;