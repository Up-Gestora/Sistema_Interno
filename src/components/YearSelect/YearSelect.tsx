import { useEffect, useRef, useState } from 'react';
import './YearSelect.css';

interface YearSelectProps {
  id: string;
  value: number;
  years: number[];
  onChange: (year: number) => void;
  disabled?: boolean;
}

export default function YearSelect({
  id,
  value,
  years,
  onChange,
  disabled = false,
}: YearSelectProps) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!aberto) return undefined;

    const handleClickFora = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setAberto(false);
      }
    };

    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [aberto]);

  return (
    <div ref={containerRef} className={`year-select${disabled ? ' is-disabled' : ''}`}>
      <button
        id={id}
        type="button"
        className="year-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => !disabled && setAberto((current) => !current)}
        disabled={disabled}
      >
        <span>{value}</span>
        <span className="year-select-caret" aria-hidden="true">
          v
        </span>
      </button>

      {aberto && (
        <div className="year-select-menu" role="listbox" aria-labelledby={id}>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className={`year-select-option${year === value ? ' is-selected' : ''}`}
              role="option"
              aria-selected={year === value}
              onClick={() => {
                onChange(year);
                setAberto(false);
              }}
            >
              {year}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

