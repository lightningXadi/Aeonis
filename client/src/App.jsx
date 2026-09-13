import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Chat from './pages/Chat';
import ChatThread from './pages/ChatThread';
import Profile from './pages/Profile';
import FriendRequests from './pages/FriendRequests';
import AddFriend from './pages/AddFriend';
import CreateGroup from './pages/CreateGroup';
import GroupDetails from './pages/GroupDetails';
import { CallProvider } from './context/CallContext';
import CallOverlay from './components/CallOverlay';

export default function App() {
  return (
    <CallProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:id" element={<ChatThread />} />
          <Route path="/chat/:id/details" element={<GroupDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/friends" element={<FriendRequests />} />
          <Route path="/friends/add" element={<AddFriend />} />
          <Route path="/groups/new" element={<CreateGroup />} />
        </Routes>
      </BrowserRouter>
      <CallOverlay />
    </CallProvider>
  );
}
