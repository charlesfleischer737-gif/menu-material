// `reversedMedia` swaps in the light logo while that media query matches, for
// places that sit on the dark surface only at some widths.
export default function Brand({
  className = "",
  reversedMedia,
}: {
  className?: string;
  reversedMedia?: string;
}) {
  const logo = (
    <img
      className="menu-material-logo"
      src="/brand/menu-material-logo.svg"
      alt="Menu Material"
      width={367}
      height={53}
      decoding="async"
    />
  );
  return (
    <span className={`menu-material-wordmark ${className}`}>
      {reversedMedia ? (
        <picture>
          <source
            media={reversedMedia}
            srcSet="/brand/menu-material-logo-reversed.svg"
          />
          {logo}
        </picture>
      ) : (
        logo
      )}
    </span>
  );
}
