import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import TopBar from './TopBar';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { GlobalLiveRegion } from '@/components/accessibility/LiveRegion';

const MainLayout = () => {
  const { user } = useAuth();
  
  // Enable realtime notifications for the current user
  useRealtimeNotifications(user?.id);

  return (
    <>
      {/* Global aria-live regions for screen reader announcements */}
      <GlobalLiveRegion />
      
      {/* Skip links for keyboard navigation */}
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo principal
      </a>
      <a href="#main-nav" className="skip-link" style={{ left: '200px' }}>
        Pular para navegação
      </a>
      
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main id="main-content" className="flex-1 overflow-auto" role="main" aria-label="Conteúdo principal">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default MainLayout;
