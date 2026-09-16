"use client";

import { ArrowLeft, Heart, Minus, Plus } from "lucide-react";
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
    kind: "delivery",
    name: "Delivery apps",
    image: "/homepage/restaurants.webp",
    alt: "Sliced steak with herb butter and golden fries on a ceramic plate",
    text: "Put your best photo on the listing. Download images ready for your delivery menu.",
  },
  {
    kind: "social",
    name: "Social media",
    image: "/homepage/social.webp",
    alt: "Crispy fish tacos with fresh slaw, herbs and lime, styled for a vibrant social post",
    text: "Give today’s special its moment with a finished post and a caption you can make your own.",
  },
  {
    kind: "menu",
    name: "Your existing menu",
    image: "/homepage/menus.webp",
    alt: "Tomato rigatoni with basil and Parmesan on a ceramic plate",
    text: "Bring your dishes to life on Toast, your website, or the menu platform you already use.",
  },
];

function OutputExample({ item }: { item: (typeof useCases)[number] }) {
  if (item.kind === "delivery") {
    return (
      <div className="pw-output-stage is-delivery">
        <figure
          className="pw-delivery-preview"
          role="img"
          aria-label="Illustrative delivery-app listing for Your restaurant: Steak and fries, $24.00. Grilled steak with herb butter and golden fries, with a quantity selector and Add to order bar."
        >
          <div aria-hidden="true">
            <div className="pw-delivery-photo">
              <img
                src={item.image}
                alt=""
                width="960"
                height="640"
                loading="lazy"
                decoding="async"
              />
              <div className="pw-delivery-photo-toolbar">
                <span>
                  <ArrowLeft size={18} />
                </span>
                <span>
                  <Heart size={18} />
                </span>
              </div>
            </div>
            <div className="pw-delivery-details">
              <span className="pw-delivery-restaurant">Your restaurant</span>
              <strong className="pw-delivery-title">Steak & fries</strong>
              <span className="pw-delivery-price">$24.00</span>
              <p>
                Grilled steak, rich herb butter, and a generous side of golden
                fries.
              </p>
            </div>
            <div className="pw-delivery-order-bar">
              <span className="pw-delivery-quantity">
                <Minus size={14} />
                <span>1</span>
                <Plus size={14} />
              </span>
              <span className="pw-delivery-add">
                <span>Add to order</span>
                <span>$24.00</span>
              </span>
            </div>
          </div>
        </figure>
      </div>
    );
  }
  if (item.kind === "social") {
    return (
      <div className="pw-output-stage is-social">
        <div className="pw-output-social">
          <img
            className="pw-output-post"
            src="/homepage/social-post-example.webp"
            alt="Example Instagram post for Your restaurant: Today’s special, Fish tacos, with crispy fish, fresh slaw and lime on a blue backdrop."
            width="640"
            height="800"
            loading="lazy"
            decoding="async"
          />
          <p className="pw-output-caption">
            Crispy fish, fresh slaw, a squeeze of lime. Meet your next favorite
            bite.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="pw-output-stage is-menu">
      <div className="pw-output-menu">
        <div className="pw-output-heading">
          <span>Your restaurant</span>
          <strong>Dinner menu</strong>
        </div>
        <img
          src={item.image}
          alt={item.alt}
          width="960"
          height="640"
          loading="lazy"
          decoding="async"
        />
        <div className="pw-output-dish">
          <div className="pw-output-dish-title">
            <strong>Tomato rigatoni</strong>
            <span>$18</span>
          </div>
          <p>Tomato sauce, fresh basil & Parmesan.</p>
        </div>
        <div className="pw-output-menu-row">
          <strong>Strawberry cheesecake</strong>
          <span>$9</span>
        </div>
      </div>
    </div>
  );
}

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
            <p className="pw-output-disclosure">
              Example layouts · Sample dishes and prices
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
              "(min-width: 1001px)": { active: false },
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
                  <OutputExample item={item} />
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
