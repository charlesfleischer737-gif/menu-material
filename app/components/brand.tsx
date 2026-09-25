// `reversed` always uses the light logo, for places that sit on the dark
// surface. `reversedMedia` swaps it in only while that media query matches, for
// places that sit on the dark surface only at some widths.
export default function Brand({
  className = "",
  reversed = false,
  reversedMedia,
}: {
  className?: string;
  reversed?: boolean;
  reversedMedia?: string;
}) {
  const logo = (
    <img
      className="menu-material-logo"
      src={
        reversed
          ? "/brand/menu-material-logo-reversed.svg"
          : "/brand/menu-material-logo.svg"
      }
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
