const BASE =
  'relative inline-flex h-10 shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-medium outline-none transition-[background-color,box-shadow,transform,border-color] duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';

export const PRIMARY_ACTION_CLASS = `${BASE} group/primary overflow-hidden bg-primary text-primary-foreground shadow-cta hover:bg-primary-hover active:shadow-none`;

export const PRIMARY_SHEEN_CLASS =
  'pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:group-hover/primary:translate-x-[300%] motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out';

export const SECONDARY_ACTION_CLASS = `${BASE} border border-border bg-card text-foreground hover:bg-surface-inset`;

export const GHOST_ACTION_CLASS = `${BASE} text-body hover:bg-muted hover:text-foreground`;

export const CHIP_CLASS =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-label font-medium text-body outline-none transition-colors hover:bg-surface-inset focus-visible:ring-2 focus-visible:ring-primary/50';

export const CHIP_ACTIVE_CLASS = 'border-primary/30 bg-brand-tint text-primary-hover hover:border-primary/40 hover:bg-brand-tint';
