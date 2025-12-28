import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopNavigation from './TopNavigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { GlobalLiveRegion } from '@/components/accessibility/LiveRegion';
import { KeyboardShortcutsHelp } from '@/components/accessibility/KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const MainLayout = () => {
  const { user } = useAuth();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  
  // Enable realtime notifications for the current user
  useRealtimeNotifications(user?.id);

  // Handle keyboard shortcuts
  useKeyboardShortcuts({
    onHelp: () => setShowShortcutsHelp(true),
    enabled: true,
  });

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
      
      <div className="flex flex-col min-h-screen w-full bg-background">
        <TopNavigation />
        <main id="main-content" className="flex-1 overflow-auto" role="main" aria-label="Conteúdo principal">
          <Outlet />
        </main>
      </div>

      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsHelp 
        open={showShortcutsHelp} 
        onOpenChange={setShowShortcutsHelp}
      />
    </>
  );
};

export default MainLayout;
