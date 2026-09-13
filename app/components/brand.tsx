export default function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`plateworthy-wordmark ${className}`}>
      plateworthy<span aria-hidden="true">.</span>
    </span>
  );
}
