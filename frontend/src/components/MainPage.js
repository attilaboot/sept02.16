import { Link } from 'react-router-dom';

const MainPage = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">
                🔧 Turbó Szerviz Kezelő
              </h1>
              <p className="text-gray-600">
                Teljes körű turbófeltöltő javítás kezelése
              </p>
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

        {/* Main Navigation Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Főmenü</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              to="/work-orders"
              className="group bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 hover:border-blue-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <span className="text-2xl">📋</span>
                </div>
                <span className="text-blue-600 group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Munkalapok kezelése
              </h3>
              <p className="text-gray-600 text-sm">
                Turbó javítási feladatok nyomon követése és kezelése
              </p>
            </Link>

            <Link
              to="/clients"
              className="group bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 hover:border-green-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <span className="text-2xl">👥</span>
                </div>
                <span className="text-green-600 group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Ügyfelek kezelése
              </h3>
              <p className="text-gray-600 text-sm">
                Ügyfél adatbázis és kapcsolattartási információk
              </p>
            </Link>

            <Link
              to="/inventory"
              className="group bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 hover:border-purple-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <span className="text-2xl">📦</span>
                </div>
                <span className="text-purple-600 group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Raktárkezelő
              </h3>  
              <p className="text-gray-600 text-sm">
                Alkatrészek és készletek nyilvántartása és mozgatása
              </p>
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Gyors műveletek</h3>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/new-work-order"
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 font-medium flex items-center gap-2"
            >
              ➕ Új munkalap
            </Link>
            <Link
              to="/parts"
              className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 font-medium flex items-center gap-2"
            >
              🔧 Alkatrészek
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;