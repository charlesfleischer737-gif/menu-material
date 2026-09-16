"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import HomepageStyleGallery from "./homepage-style-gallery";
const useCases = [
  {
    name: "Delivery apps",
    image: "/homepage/restaurants.webp",
    alt: "Sliced steak with herb butter and golden fries on a ceramic plate",
    text: "Make the first bite happen with a photo. Clean, appetizing images for your delivery listings.",
  },
  {
    name: "Social media",
    image: "/homepage/social.webp",
    alt: "Crispy fish tacos with fresh slaw, herbs and lime, styled for a vibrant social post",
    text: "Give today’s special its moment. Beautiful posts, Stories, and captions ready to make your own.",
  },
  {
    name: "Your existing menu",
    image: "/homepage/menus.webp",
    alt: "Tomato rigatoni with basil and Parmesan on a ceramic plate",
    text: "Refresh the photos on Toast, your website, or the menu platform you already use.",
  },
];

export default function HomepageSections() {
  return (
    <>
      <section
        className="pw-use-cases"
        id="use-cases"
        aria-labelledby="use-cases-title"
        tabIndex={-1}
      >
        <div className="pw-section-heading pw-split-heading">
          <div>
            <h2 id="use-cases-title">Made for your restaurant.</h2>
          </div>
          <div className="pw-use-case-intro">
            <p>
              Better food photos for your menu, delivery listings, and social
              posts.
            </p>
          </div>
        </div>
        <Carousel
          className="pw-use-case-carousel"
          aria-label="Ways to use Plateworthy"
          tabIndex={0}
          opts={{
            align: "start",
            loop: false,
            breakpoints: {
              "(min-width: 701px)": { active: false },
              "(prefers-reduced-motion: reduce)": { duration: 0 },
            },
          }}
        >
          <CarouselContent className="pw-use-case-slides">
            {useCases.map((item, index) => (
              <CarouselItem
                className="pw-use-case-slide"
                key={item.name}
                aria-label={`${index + 1} of ${useCases.length}: ${item.name}`}
              >
                <article className="pw-use-case">
                  <div className="pw-use-case-photo">
                    <img
                      src={item.image}
                      alt={item.alt}
                      width="960"
                      height="640"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <h3>{item.name}</h3>
                  <p>{item.text}</p>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="pw-gallery-controls">
            <span>Swipe to explore</span>
            <div>
              <CarouselPrevious aria-label="Previous use case" />
              <CarouselNext aria-label="Next use case" />
            </div>
          </div>
        </Carousel>
      </section>
      <HomepageStyleGallery />
    </>
  );
}
