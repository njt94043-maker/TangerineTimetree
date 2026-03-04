import React from 'react';
import { WifiOff, Wifi, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineIndicator({ isOnline, queueLength, onSync }) {
  return (
    <AnimatePresence>
      {(!isOnline || queueLength > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-20 right-4 z-40 ${
            isOnline ? 'bg-orange-500/90' : 'bg-red-500/90'
          } backdrop-blur-md text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2`}
        >
          {isOnline ? (
            <>
              <Cloud className="w-4 h-4" />
              <span className="text-sm font-medium">
                {queueLength} change{queueLength !== 1 ? 's' : ''} pending sync
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={onSync}
                className="h-6 px-2 text-white hover:bg-white/20"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Sync Now
              </Button>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">Offline Mode</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}