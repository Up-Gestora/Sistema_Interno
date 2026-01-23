import { useMoneyVisibility } from '../../contexts/MoneyVisibilityContext';
import './MoneyVisibilityToggle.css';

export default function MoneyVisibilityToggle() {
  const { showValues, toggleValues } = useMoneyVisibility();

  return (
    <button
      className="money-visibility-toggle"
      onClick={toggleValues}
      aria-label={showValues ? 'Ocultar valores' : 'Mostrar valores'}
      title={showValues ? 'Ocultar valores' : 'Mostrar valores'}
      type="button"
    >
      {showValues ? '🐵' : '🙈'}
    </button>
  );
}


