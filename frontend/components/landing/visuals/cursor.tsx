import { CLOCK } from './config';

export function Cursor({ x, y, pressed = false }: { x: number; y: number; pressed?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 hidden [container-type:size] md:block" aria-hidden>
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        className="absolute left-0 top-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
        style={{
          transform: `translate(calc(${x}cqw - 4px), calc(${y}cqh - 3px)) scale(${pressed ? 0.88 : 1})`,
          transition: `transform ${CLOCK.stepMs * 2}ms linear`,
        }}
      >
        <path d="M4 3l13 7-5.5 1.6L9 17z" fill="#fff" stroke="#0b0b12" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
