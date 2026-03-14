import { type ButtonHTMLAttributes, type InputHTMLAttributes, type HTMLAttributes, forwardRef } from 'react';

// --- Button ---

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'neo-btn bg-brand-500 text-white hover:bg-brand-600',
  secondary: 'neo-btn bg-white text-neo-black hover:bg-gray-50',
  danger: 'neo-btn bg-neo-red text-white hover:bg-red-500',
  ghost: 'inline-flex items-center justify-center rounded-lg px-3 py-1.5 font-medium text-neo-black hover:bg-gray-100 transition-colors',
};

const sizeClasses = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-6 py-3',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';

// --- Card ---

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`${hover ? 'neo-card-hover' : 'neo-card'} p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// --- Input ---

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input ref={ref} className={`neo-input ${className}`} {...props} />
  )
);
Input.displayName = 'Input';

// --- Badge ---

type BadgeColor = 'brand' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray';

const badgeColorClasses: Record<BadgeColor, string> = {
  brand: 'bg-brand-100 text-brand-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  gray: 'bg-gray-100 text-gray-700',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
}

export function Badge({ color = 'gray', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`neo-badge ${badgeColorClasses[color]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
