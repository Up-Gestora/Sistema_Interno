import { useSidebar } from '../../contexts/SidebarContext';
import Sidebar from '../Sidebar/Sidebar';
import ThemeSwitch from '../ThemeSwitch/ThemeSwitch';
import MoneyVisibilityToggle from '../MoneyVisibilityToggle/MoneyVisibilityToggle';
import Logo from '../Logo/Logo';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout-main">
        <header className="header">
          <div className="header-content">
            <Logo showText={true} size="medium" />
            <div className="header-right">
              <MoneyVisibilityToggle />
              <ThemeSwitch />
              <span className="user-email">igor.ss@empresa.com.br</span>
            </div>
          </div>
        </header>
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

