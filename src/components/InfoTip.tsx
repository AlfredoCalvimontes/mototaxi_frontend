import { useId, useState } from 'react';

import { strings } from '@/lib/strings';

/**
 * A small "i" that explains a setting in words. Opens on hover, keyboard focus
 * or tap, and closes on Escape — a tooltip that only works with a mouse does
 * nothing on the phone the manager is most likely holding.
 */
export function InfoTip({ text }: { text: string }) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={strings.common.moreInfo}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setPinned((value) => !value)}
        onBlur={() => setPinned(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setPinned(false);
            setHovered(false);
          }
        }}
        className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-full left-0 z-20 mt-2 w-72 max-w-[80vw] rounded-md bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed font-normal text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
