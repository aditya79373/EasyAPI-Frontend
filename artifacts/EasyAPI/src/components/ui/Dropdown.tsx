import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type Opt = { value: string; label: string };
type Props = {
  value: string | number;
  onChange: (v: string) => void;
  options: (string | number | Opt)[];
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

export function Dropdown({ value, onChange, options, className = '', ariaLabel, disabled }: Props) {
  const opts: Opt[] = options.map((o) =>
    typeof o === 'object' ? o : { value: String(o), label: String(o) },
  );
  const cur = opts.find((o) => o.value === String(value)) || opts[0];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('touchstart', down);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('touchstart', down);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className={`dd ${className}`} ref={ref}>
      <button
        type="button"
        className={`dd-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dd-label">{cur?.label}</span>
        <ChevronDown size={15} className="dd-chevron" />
      </button>
      {open && (
        <div className="dd-menu" role="listbox">
          {opts.map((o) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === String(value)}
              className={`dd-item ${o.value === String(value) ? 'selected' : ''}`}
              onClick={() => {
                setOpen(false);
                if (o.value !== String(value)) onChange(o.value);
              }}
            >
              <span>{o.label}</span>
              {o.value === String(value) && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}