import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { getStoredAccount, getToken } from './api';
import type { PublicAccount } from './types';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';
import Leaderboard from './pages/Leaderboard';

export default function App() {
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const acc = getStoredAccount();
    const token = getToken();
    if (acc && token) {
      setAccount(acc);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('junqi_token');
    localStorage.removeItem('junqi_account');
    setAccount(null);
    navigate('/login');
  };

  if (!account) {
    return (
      <div className="app-bg">
        <Routes>
          <Route path="/login" element={<Login onLogin={setAccount} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <Routes>
        <Route path="/" element={<Lobby account={account} onLogout={handleLogout} />} />
        <Route path="/room/:code" element={<Room account={account} />} />
        <Route path="/game/:code" element={<Game account={account} />} />
        <Route path="/leaderboard" element={<Leaderboard account={account} onLogout={handleLogout} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
