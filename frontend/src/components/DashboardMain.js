import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardMain = () => {
  const [stats, setStats] = useState({
    totalWorkOrders: 0,
    inProgress: 0,
    ready: 0,
    delivered: 0
  });
  const [recentWorkOrders, setRecentWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load work orders for statistics
      const workOrdersResponse = await axios.get(`${API}/work-orders`);
      const workOrders = workOrdersResponse.data;

      // Calculate statistics
      const totalWorkOrders = workOrders.length;
      const inProgress = workOrders.filter(wo => 
        ['IN_PROGRESS', 'QUOTED', 'ACCEPTED', 'WORKING'].includes(wo.status)
      ).length;
      const ready = workOrders.filter(wo => wo.status === 'READY').length;
      const delivered = workOrders.filter(wo => wo.status === 'DELIVERED').length;

      setStats({
        totalWorkOrders,
        inProgress,
        ready,
        delivered
      });

      // Get 5 most recent work orders
      const recent = workOrders
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);
      
      setRecentWorkOrders(recent);
      setLoading(false);
    } catch (error) {
      console.error('Hiba a dashboard adatok betöltésekor:', error);
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Dashboard betöltése...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-start mb-12">
          <div className="flex items-center gap-4">
            <div className="text-6xl">🔧</div>
            <div>
              <h1 className="text-5xl font-bold text-gray-800 mb-2">
                Turbó Szerviz Kezelő
              </h1>
              <p className="text-xl text-gray-600">
                Teljes körű turbófeltöltő javítás kezelése
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Link
              to="/admin"
              className="bg-red-500 text-white px-8 py-4 rounded-xl hover:bg-red-600 font-bold text-lg flex items-center gap-2 shadow-lg"
            >
              🛡️ ADMIN
            </Link>
            <Link
              to="/settings"
              className="bg-gray-600 text-white px-8 py-4 rounded-xl hover:bg-gray-700 font-bold text-lg flex items-center gap-2 shadow-lg"
            >
              ⚙️ SETTINGS
            </Link>
          </div>
        </header>

        {/* Navigation Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
          <Link
            to="/workspace"
            className="bg-blue-500 text-white p-6 rounded-2xl hover:bg-blue-600 transition-all duration-200 shadow-lg group"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏠</span>
              <span className="text-xl font-bold">Főmenü</span>
            </div>
          </Link>

          <Link
            to="/clients"
            className="bg-gray-500 text-white p-6 rounded-2xl hover:bg-gray-600 transition-all duration-200 shadow-lg group"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">👥</span>
              <span className="text-xl font-bold">Ügyfelek</span>
            </div>
          </Link>

          <Link
            to="/work-orders"
            className="bg-green-500 text-white p-6 rounded-2xl hover:bg-green-600 transition-all duration-200 shadow-lg group"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <span className="text-xl font-bold">Munkalapok</span>
            </div>
          </Link>

          <Link
            to="/work-orders/new"
            className="bg-purple-500 text-white p-6 rounded-2xl hover:bg-purple-600 transition-all duration-200 shadow-lg group"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">➕</span>
              <span className="text-xl font-bold">Új Munkalap</span>
            </div>
          </Link>

          <Link
            to="/settings"
            className="bg-orange-500 text-white p-6 rounded-2xl hover:bg-orange-600 transition-all duration-200 shadow-lg group"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔧</span>
              <span className="text-xl font-bold">Alkatrészek</span>
            </div>
          </Link>

          <Link
            to="/inventory"
            className="bg-indigo-500 text-white p-6 rounded-2xl hover:bg-indigo-600 transition-all duration-200 shadow-lg group"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">📦</span>
              <span className="text-xl font-bold">Raktár</span>
            </div>
          </Link>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-4 rounded-full">
                <span className="text-3xl">📊</span>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Összes munka</p>
                <p className="text-4xl font-bold text-gray-800">{stats.totalWorkOrders}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-100 p-4 rounded-full">
                <span className="text-3xl">⚡</span>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Folyamatban</p>
                <p className="text-4xl font-bold text-gray-800">{stats.inProgress}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-4 rounded-full">
                <span className="text-3xl">✅</span>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Kész</p>
                <p className="text-4xl font-bold text-gray-800">{stats.ready}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-4 rounded-full">
                <span className="text-3xl">📦</span>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Átvett</p>
                <p className="text-4xl font-bold text-gray-800">{stats.delivered}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Work Orders */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Legújabb munkalapok</h2>
            <Link
              to="/work-orders"
              className="text-blue-500 hover:text-blue-600 font-medium"
            >
              Összes megtekintése →
            </Link>
          </div>

          {recentWorkOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-xl">Még nincsenek munkalapok</p>
              <Link
                to="/work-orders/new"
                className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-medium mt-4 inline-block"
              >
                ➕ Első munkalap létrehozása
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentWorkOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/work-orders/${order.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-500 text-white px-3 py-1 rounded font-bold">
                        #{order.work_number}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {order.client_name} - {order.car_make} {order.car_model}
                        </p>
                        <p className="text-sm text-gray-500">
                          Turbó: {order.turbo_code} | 📅 {new Date(order.created_at).toLocaleDateString('hu-HU')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                        {statusTranslations[order.status] || order.status}
                      </span>
                      <span className="font-bold text-lg">
                        {(order.cleaning_price + order.reconditioning_price + order.turbo_price).toFixed(0)} LEI
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardMain;