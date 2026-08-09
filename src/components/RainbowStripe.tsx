export function RainbowStripe({ className = "" }: { className?: string }) {
  return (
    <div className={`rainbow-stripe ${className}`} aria-hidden="true">
      <span /><span /><span /><span /><span /><span /><span /><span /><span />
    </div>
  );
}
