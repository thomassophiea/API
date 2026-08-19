import { AlertTriangle } from 'lucide-react';

/**
 * Persistent, non-dismissible notice shown above every screen.
 *
 * This is an internal engineering utility, not an Extreme Networks
 * product. It is deliberately not dismissible: anyone pointing it at a
 * production Gateway should see this every time, not once.
 */
export function DisclaimerBanner() {
  return (
    <div
      role="note"
      className="flex flex-shrink-0 items-center justify-center gap-2 border-b border-border bg-muted px-4 py-1.5 text-center"
    >
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Unofficial &amp; unsupported.</span>{' '}
        This is not an Extreme Networks product and carries no warranty or support. Use at your own risk.
      </p>
    </div>
  );
}
