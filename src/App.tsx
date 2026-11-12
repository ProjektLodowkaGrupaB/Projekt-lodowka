import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PantryPage from './pages/PantryPage';
import RecipesPage from './pages/RecipesPage';
import FavoritesPage from './pages/FavoritesPage';
import EquipmentPage from './pages/EquipmentPage';
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
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;