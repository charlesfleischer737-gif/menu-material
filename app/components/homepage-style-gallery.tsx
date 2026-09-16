"use client";

import { ArrowRight, Expand } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const styles = [
  {
    id: "dark",
    name: "Dark & dramatic",
    detail: "Rich shadows. All the focus.",
  },
  { id: "color", name: "Bold color", detail: "A little more personality." },
  { id: "rustic", name: "Rustic table", detail: "Warm, welcoming, familiar." },
  {
    id: "daylight",
    name: "Daylight café",
    detail: "Fresh light. A softer mood.",
  },
];

export default function HomepageStyleGallery() {
  return (
    <section className="pw-style-gallery" aria-labelledby="style-gallery-title">
      <div className="pw-section-heading pw-style-heading">
        <h2 id="style-gallery-title">One photo. Endless possibilities.</h2>
        <p>
          Find a look that feels like you. Change the setting, lighting, and
          mood.
        </p>
      </div>
      <div className="pw-style-journey">
        <figure className="pw-style-original">
          <img
            src="/homepage/styles/cheesecake-original-640.webp"
            srcSet="/homepage/styles/cheesecake-original-320.webp 320w, /homepage/styles/cheesecake-original-640.webp 640w"
            sizes="(max-width: 700px) 64px, 190px"
            alt="Original photograph of a strawberry cheesecake slice on a white plate"
            width={640}
            height={480}
            loading="lazy"
            decoding="async"
          />
          <figcaption>
            <strong>Your starting photo</strong>
            <span>One dish. Your camera.</span>
          </figcaption>
        </figure>
        <ArrowRight
          className="pw-style-direction"
          size={22}
          aria-hidden="true"
        />
        <Carousel
          className="pw-style-carousel"
          aria-label="Four styles from one strawberry cheesecake photo"
          tabIndex={0}
          opts={{
            align: "start",
            breakpoints: {
              "(min-width: 701px)": { active: false },
              "(prefers-reduced-motion: reduce)": { duration: 0 },
            },
          }}
        >
          <CarouselContent className="pw-style-slides">
            {styles.map((style) => (
              <CarouselItem className="pw-style-slide" key={style.id}>
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      className="pw-style-card"
                      type="button"
                      aria-label={`Compare the original photo with ${style.name}`}
                    >
                      <span className="pw-style-image">
                        <img
                          src={`/homepage/styles/cheesecake-${style.id}-640.webp`}
                          srcSet={`/homepage/styles/cheesecake-${style.id}-320.webp 320w, /homepage/styles/cheesecake-${style.id}-480.webp 480w, /homepage/styles/cheesecake-${style.id}-640.webp 640w, /homepage/styles/cheesecake-${style.id}.webp 1254w`}
                          sizes="(max-width: 700px) 58vw, (max-width: 1000px) 20vw, 215px"
                          alt={`The same strawberry cheesecake reimagined in the ${style.name.toLowerCase()} style`}
                          width={1254}
                          height={1254}
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                        />
                        <span className="pw-style-expand" aria-hidden="true">
                          <Expand size={15} />
                        </span>
                      </span>
                      <strong>{style.name}</strong>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="pw-style-dialog">
                    <DialogHeader>
                      <DialogTitle>{style.name}</DialogTitle>
                      <DialogDescription>{style.detail}</DialogDescription>
                    </DialogHeader>
                    <div className="pw-style-comparison">
                      <figure>
                        <img
                          src="/homepage/styles/cheesecake-original-640.webp"
                          srcSet="/homepage/styles/cheesecake-original-640.webp 640w, /homepage/styles/cheesecake-original-960.webp 960w, /homepage/styles/cheesecake-original.jpg 2592w"
                          sizes="(max-width: 860px) 42vw, 394px"
                          alt="Original strawberry cheesecake photograph before styling"
                          width={640}
                          height={480}
                          decoding="async"
                        />
                        <figcaption>Original photo</figcaption>
                      </figure>
                      <figure>
                        <img
                          src={`/homepage/styles/cheesecake-${style.id}.webp`}
                          alt={`Illustrative AI edit of the strawberry cheesecake in the ${style.name.toLowerCase()} style`}
                          width={1254}
                          height={1254}
                          decoding="async"
                        />
                        <figcaption>{style.name}</figcaption>
                      </figure>
                    </div>
                    <p className="pw-style-disclosure">
                      Illustrative AI edit. Review your results before sharing.
                    </p>
                  </DialogContent>
                </Dialog>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="pw-style-carousel-controls">
            <span>Explore the looks</span>
            <div>
              <CarouselPrevious aria-label="Previous style" />
              <CarouselNext aria-label="Next style" />
            </div>
          </div>
        </Carousel>
      </div>
      <p className="pw-style-disclosure">
        Illustrative AI edits · Select a style to compare with the original.
      </p>
    </section>
  );
}
