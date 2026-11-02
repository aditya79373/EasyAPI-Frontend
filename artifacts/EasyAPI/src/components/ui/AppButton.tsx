import type { ReactNode } from 'react';

export const Button = ({
  children,
  onClick,
  kind = 'secondary',
  className = '',
  type = 'button',
  disabled = false,
  'data-testid': testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  'data-testid'?: string;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
    className={`btn btn-${kind} ${className}`}
  >
    {children}
  </button>
);