export default function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`plateworthy-wordmark menu-material-wordmark ${className}`}>
      menu<span className="menu-material-name"> material</span>
      <span aria-hidden="true">.</span>
    </span>
  );
}
