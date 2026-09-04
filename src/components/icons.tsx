/** Iconos SVG en linea (sin dependencias) con trazo heredado del color actual. */

type P = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconBook = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export const IconCalendar = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 10h18M8 2v4M16 2v4" />
  </svg>
);

export const IconCart = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2 3h3l2.6 12.4a1.5 1.5 0 0 0 1.5 1.2h8.3a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
  </svg>
);

export const IconData = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M12 3v13" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 21h16" />
  </svg>
);

export const IconWallet = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <rect x="2" y="6" width="20" height="14" rx="2.5" />
    <path d="M2 10.5h20" />
    <path d="M16.5 15.5h.01" strokeWidth={2.6} />
  </svg>
);

export const IconPlus = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconClose = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const IconCheck = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2.6} aria-hidden="true">
    <path d="m20 6-11 11-5-5" />
  </svg>
);

export const IconTrash = ({ size = 18 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />
  </svg>
);

export const IconStar = ({ size = 19, filled = false }: P & { filled?: boolean }) => (
  <svg {...base(size)} fill={filled ? 'currentColor' : 'none'} aria-hidden="true">
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  </svg>
);

export const IconClock = ({ size = 14 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconPlane = ({ size = 15 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.6.6 0 0 0-.6.9l3.4 5-2.2 2.2-2.1-.6a.5.5 0 0 0-.5.8l2 2 2 2a.5.5 0 0 0 .8-.5l-.6-2.1 2.2-2.2 5 3.4a.6.6 0 0 0 .9-.6z" />
  </svg>
);

export const IconEdit = ({ size = 18 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

export const IconCopy = ({ size = 17 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const IconChef = ({ size = 22 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M6 17h12v3a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
    <path d="M6 17a4.5 4.5 0 0 1-1.2-8.8 4 4 0 0 1 7.2-2.6 4 4 0 0 1 7.2 2.6A4.5 4.5 0 0 1 18 17" />
  </svg>
);

export const IconGrip = ({ size = 18 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);
