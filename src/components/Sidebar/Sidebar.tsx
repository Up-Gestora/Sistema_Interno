import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Wallet,
  Users,
  User,
  Target,
  Briefcase,
  FileText,
  TrendingUp,
  Link2,
  FileSignature,
  Database,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import Logo from '../Logo/Logo';
import './Sidebar.css';

type SidebarMenuItem = {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
  children?: Array<{
    id: string;
    path: string;
    label: string;
  }>;
};

export default function Sidebar() {
  const location = useLocation();
  const { isHovered, handleMouseEnter, handleMouseLeave } = useSidebar();
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);

  const menuItems: SidebarMenuItem[] = [
    { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'financeiro',
      path: '/asaas/contas',
      label: 'Financeiro',
      icon: Wallet,
      children: [
        { id: 'financeiro-contas', path: '/asaas/contas', label: 'Contas' },
        { id: 'financeiro-pagamentos', path: '/asaas/pagamentos', label: 'Pagamentos' },
      ],
    },
    { id: 'clientes', path: '/clientes', label: 'Clientes', icon: Users },
    { id: 'membros', path: '/membros', label: 'Membros/Equipe', icon: User },
    { id: 'estrategias', path: '/estrategias', label: 'Estratégias', icon: Target },
    { id: 'private', path: '/private', label: 'Private', icon: Briefcase },
    {
      id: 'relatorios',
      path: '/relatorios',
      label: 'Relatórios',
      icon: FileText,
      children: [
        { id: 'relatorios-rebalanceamento', path: '/relatorios', label: 'Rebalanceamento' },
        { id: 'relatorios-periodicos', path: '/relatorios/periodicos', label: 'Periódicos' },
        { id: 'relatorios-laminas', path: '/laminas', label: 'Lâminas' },
        { id: 'relatorios-dados-diarios', path: '/estrategia-diaria', label: 'Dados Diários' },
      ],
    },
    { id: 'atualizacao-credito', path: '/atualizacao-credito', label: 'Atualizacao de Credito', icon: Wallet },
    { id: 'performance', path: '/performance', label: 'Performance', icon: TrendingUp },
    { id: 'links-uteis', path: '/links-uteis', label: 'Links úteis', icon: Link2 },
    { id: 'assinafy', path: '/assinafy', label: 'Assinafy', icon: FileSignature },
    { id: 'importacao', path: '/importacao-planilha', label: 'Dados', icon: Database },
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
          const Icon = item.icon;
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
                <span className="sidebar-icon">
                  <Icon size={20} strokeWidth={2.1} aria-hidden="true" />
                </span>
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
