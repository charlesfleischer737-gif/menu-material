export default function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`plateworthy-wordmark menu-material-wordmark ${className}`}>
      <img
        className="menu-material-logo"
        src="/brand/menu-material-logo.svg?v=terracotta"
        alt="Menu Material"
        width={1264}
        height={240}
        decoding="async"
      />
    </span>
  );
}
