import { createContext, useContext, useState, useRef, ReactNode } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  isHovered: boolean;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    // Limpar timeout se existir (mouse voltou antes do delay)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Adicionar delay de 200ms antes de recuar
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      timeoutRef.current = null;
    }, 200);
  };

  return (
    <SidebarContext.Provider value={{ 
      isCollapsed: !isHovered, 
      toggleSidebar: () => {}, // Mantido para compatibilidade, mas não usado
      isHovered,
      handleMouseEnter,
      handleMouseLeave
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

