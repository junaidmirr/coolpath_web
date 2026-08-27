import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import MapPage from './pages/MapPage';
import History from './pages/History';
import Assistant from './pages/Assistant';
import SettingsPage from './pages/SettingsPage';




function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navbar সবসময় উপরে থাকবে */}
      <Navbar />

      {/* URL অনুযায়ী নিচের পেজগুলো লোড হবে */}
      <main className="p-4">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/history" element={<History />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;