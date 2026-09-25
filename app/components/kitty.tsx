import type { ReactNode } from "react";

// Decorative kitties for a few quiet corners of the site and workspace. They
// are hidden from assistive technology and never appear in restaurant
// artwork (menus, posts, exports). Plain SVG without state, so server and
// client components can both use them. Colors and motion are in kitties.css.

export type KittyPose = "sit" | "sleep" | "peek" | "box";

// One face for every pose, drawn around its center. Poses place it with a
// translate on the wrapping group, so the parts inside stay free for CSS
// transforms (blinks, glances, ear flicks).
function Face({
  x,
  y,
  asleep = false,
}: {
  x: number;
  y: number;
  asleep?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="kitty-ear kitty-ear-left">
        <path className="kitty-fur" d="M-17 -4 L-15.5 -23 L-2.5 -13.5 Z" />
        <path
          className="kitty-inner-ear"
          d="M-13.8 -10.5 L-13.2 -18.6 L-7 -13.8 Z"
        />
      </g>
      <g className="kitty-ear kitty-ear-right">
        <path className="kitty-fur" d="M17 -4 L15.5 -23 L2.5 -13.5 Z" />
        <path
          className="kitty-inner-ear"
          d="M13.8 -10.5 L13.2 -18.6 L7 -13.8 Z"
        />
      </g>
      <ellipse className="kitty-fur" rx="19" ry="16" />
      <path
        className="kitty-whisker"
        d="M-18.3 4.2 L-27 2.4 M-17.4 7.4 L-26 8.6 M18.3 4.2 L27 2.4 M17.4 7.4 L26 8.6"
      />
      {asleep ? (
        <path
          className="kitty-closed-eyes"
          d="M-11.5 1.5 Q-7.5 5 -3.5 1.5 M3.5 1.5 Q7.5 5 11.5 1.5"
        />
      ) : (
        <>
          <g className="kitty-eyes">
            <ellipse
              className="kitty-iris"
              cx="-7.5"
              cy="1"
              rx="4.4"
              ry="4.9"
            />
            <ellipse className="kitty-iris" cx="7.5" cy="1" rx="4.4" ry="4.9" />
            <g className="kitty-pupils">
              <ellipse
                className="kitty-pupil"
                cx="-7.5"
                cy="1.3"
                rx="1.7"
                ry="3.5"
              />
              <ellipse
                className="kitty-pupil"
                cx="7.5"
                cy="1.3"
                rx="1.7"
                ry="3.5"
              />
            </g>
            <circle className="kitty-shine" cx="-6" cy="-1.1" r="1.2" />
            <circle className="kitty-shine" cx="9" cy="-1.1" r="1.2" />
          </g>
          {/* Pointer hover swaps in contented eyes and a small heart. */}
          <path
            className="kitty-happy-eyes"
            d="M-11.5 2.5 Q-7.5 -2.5 -3.5 2.5 M3.5 2.5 Q7.5 -2.5 11.5 2.5"
          />
          <path
            className="kitty-heart"
            d="M0 -24 C-1.2 -26.6 -5 -26.2 -5 -23.2 C-5 -20.8 -2.2 -19.2 0 -17.4 C2.2 -19.2 5 -20.8 5 -23.2 C5 -26.2 1.2 -26.6 0 -24 Z"
          />
        </>
      )}
      <path className="kitty-nose" d="M-1.8 6.4 H1.8 L0 8.4 Z" />
      <path
        className="kitty-mouth"
        d="M-2.7 9.8 Q-1.35 11.1 0 9.8 Q1.35 11.1 2.7 9.8"
      />
    </g>
  );
}

const poses: Record<KittyPose, { viewBox: string; art: ReactNode }> = {
  // Sitting upright, tail swishing.
  sit: {
    viewBox: "0 0 64 76",
    art: (
      <>
        <path
          className="kitty-tail"
          d="M45 73 C55 74 61 68 60 58 C59.5 52 56 49 59.5 44.5"
        />
        <path
          className="kitty-fur"
          d="M17 76 C12 76 11 69 12.5 62 C15 50 21 42 32 40.5 C43 42 49 50 51.5 62 C53 69 52 76 47 76 Z"
        />
        <path className="kitty-detail-line" d="M32 60 V73.5" />
        <ellipse className="kitty-fur" cx="26.3" cy="74.1" rx="5.2" ry="2.7" />
        <ellipse className="kitty-fur" cx="37.7" cy="74.1" rx="5.2" ry="2.7" />
        <path
          className="kitty-toes"
          d="M24.6 72.6 V74.4 M28 72.6 V74.4 M36 72.6 V74.4 M39.4 72.6 V74.4"
        />
        <Face x={32} y={30} />
      </>
    ),
  },
  // A loaf, fast asleep.
  sleep: {
    viewBox: "0 0 92 56",
    art: (
      <>
        {/* Drawn, not <text>, so the "z"s never join the page's text (copy,
            reader modes, innerText) the way aria-hidden alone can't prevent. */}
        <g className="kitty-zzz">
          <path d="M52.6 18.2 H55.6 L52.6 21.4 H55.6" />
          <path d="M59.75 10.25 H63.45 L59.75 14.25 H63.45" />
          <path d="M67.9 1.3 H72.3 L67.9 6.1 H72.3" />
        </g>
        <g className="kitty-breath">
          <path
            className="kitty-fur"
            d="M9 56 C4.5 56 3.5 51 5 46 C7.5 38 16 32.5 30 31.5 L62 30.5 C76 30.5 86.5 37.5 87.5 47 C88 52 86.5 56 81.5 56 Z"
          />
          <path
            className="kitty-curled-tail-edge"
            d="M85 43.5 C89 52.5 74 53.5 58 51.5 C53 50.9 50 49.5 49 47.5"
          />
          <path
            className="kitty-curled-tail"
            d="M85 43.5 C89 52.5 74 53.5 58 51.5 C53 50.9 50 49.5 49 47.5"
          />
          <Face x={28} y={38} asleep />
          <path
            className="kitty-detail-line"
            d="M45.25 31.3 A19 16 0 0 1 34.5 53"
          />
        </g>
      </>
    ),
  },
  // Head and paws over a ledge.
  peek: {
    viewBox: "0 0 72 44",
    art: (
      <>
        <Face x={36} y={27} />
        <rect
          className="kitty-ledge"
          x="0"
          y="40"
          width="72"
          height="4"
          rx="2"
        />
        <ellipse className="kitty-fur" cx="21" cy="39.6" rx="6" ry="3.4" />
        <ellipse className="kitty-fur" cx="51" cy="39.6" rx="6" ry="3.4" />
        <path
          className="kitty-toes"
          d="M19 37.4 V39.2 M23 37.4 V39.2 M49 37.4 V39.2 M53 37.4 V39.2"
        />
      </>
    ),
  },
  // Peeking out of an open moving box.
  box: {
    viewBox: "0 0 100 84",
    art: (
      <>
        <path className="kitty-box-flap" d="M16 46 L3 31 L25 28 L34 46 Z" />
        <path className="kitty-box-flap" d="M84 46 L97 31 L75 28 L66 46 Z" />
        <rect
          className="kitty-box-inside"
          x="16"
          y="40"
          width="68"
          height="8"
        />
        <Face x={50} y={31} />
        <rect
          className="kitty-box-front"
          x="16"
          y="46"
          width="68"
          height="38"
          rx="2.5"
        />
        <rect className="kitty-box-tape" x="45" y="46" width="10" height="15" />
        <ellipse className="kitty-fur" cx="36" cy="46.2" rx="6" ry="3.4" />
        <ellipse className="kitty-fur" cx="64" cy="46.2" rx="6" ry="3.4" />
        <path
          className="kitty-toes"
          d="M34 44 V45.8 M38 44 V45.8 M62 44 V45.8 M66 44 V45.8"
        />
      </>
    ),
  },
};

export default function Kitty({
  pose = "sit",
  className,
}: {
  pose?: KittyPose;
  className?: string;
}) {
  const { viewBox, art } = poses[pose];
  return (
    <svg
      className={`kitty kitty-${pose}${className ? ` ${className}` : ""}`}
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
    >
      {art}
    </svg>
  );
}
