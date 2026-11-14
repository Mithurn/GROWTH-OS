const BASE =
  'relative inline-flex h-10 shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-medium outline-none transition-[background-color,box-shadow,transform,border-color] duration-200 focus-visible:ring-2 focus-visible:ring-[#5B4FFF]/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';

export const PRIMARY_ACTION_CLASS = `${BASE} group/primary overflow-hidden bg-gradient-to-b from-[#6A5DFF] to-[#4B3FE5] text-white shadow-[0_1px_2px_rgba(55,40,200,0.35),0_6px_16px_-6px_rgba(91,79,255,0.55),inset_0_1px_0_rgba(255,255,255,0.28)] ring-1 ring-inset ring-[#3B30C9]/60 hover:from-[#7467FF] hover:to-[#5446F0] hover:shadow-[0_1px_2px_rgba(55,40,200,0.35),0_10px_24px_-8px_rgba(91,79,255,0.65),inset_0_1px_0_rgba(255,255,255,0.32)] active:shadow-[0_1px_1px_rgba(55,40,200,0.4),inset_0_2px_4px_rgba(30,20,120,0.25)]`;

export const PRIMARY_SHEEN_CLASS =
  'pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:group-hover/primary:translate-x-[300%] motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out';

export const SECONDARY_ACTION_CLASS = `${BASE} border border-black/[0.09] bg-white text-[#1A1A1A] shadow-[0_1px_2px_rgba(16,24,40,0.05),inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-black/[0.14] hover:bg-[#F9FAFB]`;

export const GHOST_ACTION_CLASS = `${BASE} text-[#4B5563] hover:bg-black/[0.04] hover:text-[#1A1A1A]`;

export const CHIP_CLASS =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 text-[13px] font-medium text-[#4B5563] shadow-[0_1px_1px_rgba(16,24,40,0.04)] outline-none transition-colors hover:border-black/[0.14] hover:bg-[#F9FAFB] focus-visible:ring-2 focus-visible:ring-[#5B4FFF]/50';

export const CHIP_ACTIVE_CLASS = 'border-[#5B4FFF]/30 bg-[#F4F2FF] text-[#4338CA] hover:border-[#5B4FFF]/40 hover:bg-[#EEEAFF]';
