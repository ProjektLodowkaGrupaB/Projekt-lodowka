import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PantryPage from './pages/PantryPage';
import RecipesPage from './pages/RecipesPage';
import FavoritesPage from './pages/FavoritesPage';
import EquipmentPage from './pages/EquipmentPage';
import ComingSoonPage from './pages/ComingSoonPage';
import Sidebar from './Sidebar';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar />
        <div className="flex-1 max-h-screen overflow-y-auto">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/spizarnia" element={<PantryPage />} />
            <Route path="/przepisy" element={<RecipesPage />} />
            <Route path="/ulubione" element={<FavoritesPage />} />
            <Route path="/wyposazenie" element={<EquipmentPage />} />
            <Route
              path="/skaner-ai"
              element={<ComingSoonPage title="Skaner produktów AI" />}
            />
            {/* Nieznany adres – powrót na stronę główną zamiast pustego ekranu */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
