// Logo de Click & Serve: flecha de cursor naranja con una llave inglesa cruzada.
// Es el mismo dibujo que LogoMark en movil/src/design/Brand.tsx; si cambia allá, cambia aquí.
const LOGO_ORANGE = '#F1630F'

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Logo de Click & Serve">
      <polygon points="94,6 6,40 44,56 60,94" fill={LOGO_ORANGE} stroke={LOGO_ORANGE} strokeWidth={5} strokeLinejoin="round" />
      <line x1={14} y1={86} x2={52} y2={48} stroke="#FFFFFF" strokeWidth={19} strokeLinecap="round" />
      <circle cx={60} cy={40} r={17} fill="#FFFFFF" />
      <line x1={14} y1={86} x2={52} y2={48} stroke={LOGO_ORANGE} strokeWidth={10} strokeLinecap="round" />
      <circle cx={60} cy={40} r={13} fill={LOGO_ORANGE} />
      <rect x={59.5} y={27.5} width={9} height={13} fill="#FFFFFF" transform="rotate(45 64 34)" />
      <circle cx={19} cy={81} r={2.6} fill="#FFFFFF" />
    </svg>
  )
}
