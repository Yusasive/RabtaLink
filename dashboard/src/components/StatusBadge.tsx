type BadgeKind = 'pending' | 'success' | 'danger' | 'neutral';

const KIND_STYLES: Record<BadgeKind, { bg: string; text: string; icon: string }> = {
  pending: { bg: 'bg-warn-soft', text: 'text-warn', icon: '⏳' },
  success: { bg: 'bg-success-soft', text: 'text-success', icon: '✓' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger', icon: '✕' },
  neutral: { bg: 'bg-accent-soft', text: 'text-accent', icon: '●' },
};

/**
 * UI-UX §6.3: status states must be communicated with color *and* text/icon,
 * never color alone — some Rabta Agents may have visual impairments common
 * in an older demographic.
 */
export function StatusBadge({ kind, label }: { kind: BadgeKind; label: string }) {
  const style = KIND_STYLES[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span aria-hidden="true">{style.icon}</span>
      {label}
    </span>
  );
}

export function consentBadge(consentStatus: string): { kind: BadgeKind; label: string } {
  switch (consentStatus) {
    case 'pending':
      return { kind: 'pending', label: 'Consent pending' };
    case 'approved':
      return { kind: 'success', label: 'Consent approved' };
    case 'declined':
      return { kind: 'danger', label: 'Consent declined' };
    default:
      return { kind: 'neutral', label: 'No consent needed' };
  }
}

export function matchStatusBadge(status: string): { kind: BadgeKind; label: string } {
  switch (status) {
    case 'proposed':
      return { kind: 'neutral', label: 'Proposed' };
    case 'accepted_a':
    case 'accepted_b':
      return { kind: 'pending', label: 'Partially accepted' };
    case 'both_accepted':
      return { kind: 'success', label: 'Both accepted' };
    case 'call_scheduled':
      return { kind: 'success', label: 'Call scheduled' };
    case 'completed':
      return { kind: 'success', label: 'Completed' };
    case 'declined':
      return { kind: 'danger', label: 'Declined' };
    default:
      return { kind: 'neutral', label: status };
  }
}
