import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function TitleBar() {
  const [isTauri, setIsTauri] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      setIsTauri(true);
      
      const win = getCurrentWindow();
      const checkMaximized = async () => {
          try {
              setIsMaximized(await win.isMaximized());
          } catch(e) { console.error("Maximized check failed", e); }
      };
      
      checkMaximized();
      
      // Add listener for resize/maximize changes if possible, 
      // otherwise rely on click handlers to update state optimistically
    }
  }, []);

  if (!isTauri) return null;

  const handleMinimize = () => getCurrentWindow().minimize();
  
  const handleMaximize = async () => {
    const win = getCurrentWindow();
    await win.toggleMaximize();
    setIsMaximized(await win.isMaximized());
  };

  const handleClose = () => getCurrentWindow().close();

  // Drag handler using the explicit API method which is more reliable on Linux than the data attribute sometimes
  const startDrag = () => {
      getCurrentWindow().startDragging();
  };

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center z-50 select-none"
      onMouseDown={startDrag} // Explicit drag handler
    >
      {/* Title Area */}
      <div className="flex items-center px-4 h-full flex-1 gap-2 pointer-events-none">
         <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
           TranscribeJS
         </span>
      </div>

      {/* Window Controls - stopPropagation prevents drag from triggering on buttons */}
      <div className="flex h-full" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors focus:outline-none cursor-default"
        >
          <Minus size={18} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors focus:outline-none cursor-default"
        >
          {isMaximized ? <Copy size={16} className="rotate-180" /> : <Square size={16} />}
        </button>
        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center hover:bg-red-500 hover:text-white text-gray-500 dark:text-gray-400 transition-colors focus:outline-none cursor-default"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
