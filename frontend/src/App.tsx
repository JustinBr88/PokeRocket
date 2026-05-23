import { Routes, Route } from 'react-router-dom';
import TitlePage from './app/routes/title';
import LoginPage from './app/routes/login';
import SignUpPage from './app/routes/sign-up';
import HomePage from './app/routes/home';
import PlayPage from './app/routes/play';
import RoomPage from './app/routes/room';
import TeamsPage from './app/routes/teams';
import BattlePage from './app/routes/battle';
import ResultsPage from './app/routes/results';
import LeaderboardsPage from './app/routes/leaderboards';
import HistoryPage from './app/routes/history';
import RulesPage from './app/routes/rules';
import PokedexPage from './app/routes/pokedex';
import PremiumPage from './app/routes/premium';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TitlePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      <Route path="/teams/:roomId" element={<TeamsPage />} />
      <Route path="/battle/:roomId" element={<BattlePage />} />
      <Route path="/results/:roomId" element={<ResultsPage />} />
      <Route path="/leaderboards" element={<LeaderboardsPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/pokedex" element={<PokedexPage />} />
      <Route path="/premium" element={<PremiumPage />} />
    </Routes>
  );
}