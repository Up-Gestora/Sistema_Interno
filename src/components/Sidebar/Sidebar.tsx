import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useSidebar } from '../../contexts/SidebarContext';
import Logo from '../Logo/Logo';
import './Sidebar.css';

export default function Sidebar() {
  const location = useLocation();
  const { isHovered, handleMouseEnter, handleMouseLeave } = useSidebar();
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);

  const menuItems = [
    { id: 'dashboard', path: '/', label: 'Dashboard', icon: '📊' },
    {
      id: 'financeiro',
      path: '/asaas/contas',
      label: 'Financeiro',
      icon: '💳',
      children: [
        { id: 'financeiro-contas', path: '/asaas/contas', label: 'Contas' },
        { id: 'financeiro-pagamentos', path: '/asaas/pagamentos', label: 'Pagamentos' },
      ],
    },
    { id: 'clientes', path: '/clientes', label: 'Clientes', icon: '👥' },
    { id: 'estrategias', path: '/estrategias', label: 'Estratégias', icon: '🎯' },
    { id: 'relatorios', path: '/relatorios-mensais', label: 'Relatórios Mensais', icon: '📄' },
    { id: 'performance', path: '/performance', label: 'Performance', icon: '📈' },
    { id: 'estrategia-diaria', path: '/estrategia-diaria', label: 'Dados Diários', icon: '🗓️' },
    { id: 'laminas', path: '/laminas', label: 'Lâminas', icon: '🗂️' },
    { id: 'importacao', path: '/importacao-planilha', label: 'Importar Planilha', icon: '📋' },
  ];

  const currentPath = location.pathname;

  return (
    <aside 
      className={`sidebar ${isHovered ? 'expanded' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="sidebar-header">
        <Logo showText={true} collapsedText={!isHovered} size="medium" />
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const isActive = hasChildren
            ? item.children!.some((child) => currentPath.startsWith(child.path))
            : currentPath === item.path || (item.path === '/' && currentPath === '/');
          const handleItemClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
            if (hasChildren) {
              event.preventDefault();
              return;
            }
            setOpenSubmenuId(null);
          };

          return (
            <div
              key={item.id}
              onMouseEnter={() => {
                if (hasChildren) setOpenSubmenuId(item.id);
              }}
              onMouseLeave={() => {
                if (hasChildren) setOpenSubmenuId(null);
              }}
            >
              <Link
                to={item.path}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={handleItemClick}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className={`sidebar-label ${isHovered ? 'visible' : ''}`}>{item.label}</span>
              </Link>
              {hasChildren && (
                <div className={`sidebar-submenu ${openSubmenuId === item.id && isHovered ? 'open' : ''}`}>
                  {item.children!.map((child) => {
                    const isChildActive = currentPath === child.path;
                    return (
                      <Link
                        key={child.id}
                        to={child.path}
                        className={`sidebar-subitem ${isChildActive ? 'active' : ''}`}
                        onClick={() => setOpenSubmenuId(item.id)}
                      >
                        <span className={`sidebar-label ${isHovered ? 'visible' : ''}`}>
                          {child.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

