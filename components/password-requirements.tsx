import { getPasswordRequirementStates } from '@/lib/password-policy'

interface PasswordRequirementsProps {
  password: string
  className?: string
}

export default function PasswordRequirements({ password, className = '' }: PasswordRequirementsProps) {
  const requirements = getPasswordRequirementStates(password)

  return (
    <div className={`grid gap-1.5 rounded-lg border border-neutral-800/80 bg-neutral-950/60 p-3 ${className}`}>
      {requirements.map((requirement) => (
        <div
          key={requirement.id}
          className={`flex items-center gap-2 text-xs font-bold transition-colors ${
            requirement.met ? 'text-emerald-400' : 'text-neutral-500'
          }`}
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
              requirement.met
                ? 'border-emerald-400 bg-emerald-400 text-black'
                : 'border-neutral-700 text-neutral-600'
            }`}
            aria-hidden="true"
          >
            {requirement.met ? '✓' : ''}
          </span>
          <span>{requirement.label}</span>
        </div>
      ))}
    </div>
  )
}
