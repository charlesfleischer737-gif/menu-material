export default function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`sidedish-wordmark ${className}`}>
      SideDish<span aria-hidden="true">.</span>
    </span>
  );
}
