import { Link } from '@tanstack/react-router'

type LogoProps = {
  height?: number
  showText?: boolean
  linkTo?: string
  className?: string
  textClassName?: string
}

export default function Logo({
  height = 30,
  showText = true,
  linkTo,
  className = 'flex shrink-0 items-center gap-2.5 no-underline',
  textClassName = 'text-xl font-extrabold tracking-tight text-[var(--fg)]',
}: LogoProps) {
  const inner = (
    <>
      <img
        src="/logo.png"
        alt="DocPro"
        style={{ height, width: 'auto' }}
      />
      {showText && <span className={textClassName}>DocPro</span>}
    </>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} aria-label="DocPro" className={className}>
        {inner}
      </Link>
    )
  }

  return <span className={className}>{inner}</span>
}
