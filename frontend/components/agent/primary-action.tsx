import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIMARY_ACTION_CLASS, PRIMARY_SHEEN_CLASS } from '@/components/ui/action-styles';

export { PRIMARY_ACTION_CLASS };

type PrimaryActionProps = {
  href?: string;
  children: ReactNode;
  className?: string;
  loading?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

export function PrimaryAction({ href, children, className, loading = false, disabled, ...buttonProps }: PrimaryActionProps) {
  const classes = cn(PRIMARY_ACTION_CLASS, className);
  const content = (
    <>
      <span className={PRIMARY_SHEEN_CLASS} aria-hidden />
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...buttonProps}>
      {content}
    </button>
  );
}
