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
          className="absolute bottom-4 right-4 z-10"
        >
          <Button
            onClick={onClick}
            size="icon"
            className="rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 relative"
          >
            <ChevronDown className="w-5 h-5" />
            {unreadCount && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const ScrollToBottomButton = memo(ScrollToBottomButtonComponent, (prev, next) =>
  prev.show === next.show && prev.unreadCount === next.unreadCount
);
