import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import TopBar from './TopBar';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

const MainLayout = () => {
  const { user } = useAuth();
  
  // Enable realtime notifications for the current user
  useRealtimeNotifications(user?.id);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
