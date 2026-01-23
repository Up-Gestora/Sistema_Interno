import { useTheme } from '../../contexts/ThemeContext';
import './ThemeSwitch.css';

export default function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      className={`theme-switch ${isDark ? 'dark' : 'light'}`}
      onClick={toggleTheme}
      aria-label={`Alternar para modo ${isDark ? 'claro' : 'escuro'}`}
      title={`Modo ${isDark ? 'escuro' : 'claro'}`}
    >
      <div className="switch-track">
        <div className="switch-thumb">
          <span className="switch-icon">{isDark ? '🌙' : '☀️'}</span>
        </div>
      </div>
    </button>
  );
}

