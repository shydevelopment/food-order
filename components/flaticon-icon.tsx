interface FlaticonIconProps {
  name: string
  className?: string
  label?: string
  prefix?: 'fi-rr' | 'fi-brands'
}

export default function FlaticonIcon({ name, className = '', label, prefix = 'fi-rr' }: FlaticonIconProps) {
  return (
    <i
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`fi ${prefix}-${name} inline-flex items-center justify-center leading-none ${className}`}
      role={label ? 'img' : undefined}
    />
  )
}
