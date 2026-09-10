import FlaticonIcon from '@/components/flaticon-icon'

export default function StatusIcon({ className = '', type }: { type: 'success' | 'error'; className?: string }) {
  return (
    <FlaticonIcon
      name={type === 'success' ? 'check' : 'exclamation'}
      className={`${className || 'h-4 w-4'} align-[-0.15em] ${type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
    />
  )
}
