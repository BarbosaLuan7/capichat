import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScrollToBottomButtonProps {
  show: boolean;
  onClick: () => void;
  unreadCount?: number;
}

function ScrollToBottomButtonComponent({ show, onClick, unreadCount }: ScrollToBottomButtonProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-4 right-4 z-20"
        >
          <Button
            onClick={onClick}
            size="icon"
            className="relative rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
            aria-label="Rolar para o final da conversa"
          >
            <ChevronDown className="h-5 w-5" />
            {unreadCount && unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const ScrollToBottomButton = memo(
  ScrollToBottomButtonComponent,
  (prev, next) => prev.show === next.show && prev.unreadCount === next.unreadCount
);
