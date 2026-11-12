import {
  OFFICIAL_PRIVACY_POLICY_URL,
  PRIVACY_POLICY_LINK_LABEL,
} from '@/constants/privacy'

interface PrivacyPolicyLinkProps {
  /** Visual treatment of the link. */
  variant?: 'default' | 'onDark' | 'muted'
  className?: string
}

/**
 * Link to the officially published Privacy Policy.
 *
 * The link opens the City Health Office privacy policy in a new tab, is
 * reachable by keyboard, and is labelled exactly "Read the Privacy Policy".
 */
export default function PrivacyPolicyLink({
  variant = 'default',
  className = '',
}: PrivacyPolicyLinkProps) {
  const base =
    'inline-flex items-center gap-1.5 rounded-md font-semibold underline underline-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

  const styles = {
    default: 'text-emerald-700 hover:text-emerald-800 focus-visible:ring-emerald-500',
    muted:
      'text-slate-600 hover:text-emerald-700 focus-visible:ring-emerald-500 focus-visible:ring-offset-white',
    onDark:
      'text-emerald-100 hover:text-white focus-visible:ring-emerald-300 focus-visible:ring-offset-emerald-900',
  }[variant]

  return (
    <a
      href={OFFICIAL_PRIVACY_POLICY_URL}
      target="_blank"
      rel="noopener noreferrer external"
      className={`${base} ${styles} ${className}`.trim()}
    >
      {PRIVACY_POLICY_LINK_LABEL}
      <span aria-hidden className="text-[0.85em] leading-none">
        ↗
      </span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
