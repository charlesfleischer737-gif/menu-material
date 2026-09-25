import type { Metadata } from "next";

// Shown to guests, with HTTP 404, for a menu address or menu link that isn't
// published (or was taken offline).
export const metadata: Metadata = {
  title: "Menu unavailable",
  robots: { index: false, follow: false },
};

export default function MenuNotFound() {
  return (
    <main className="unavailable">
      <h1>This menu isn’t available right now.</h1>
      <p>Please ask the restaurant.</p>
      <p>
        <small>Made with Menu Material</small>
      </p>
    </main>
  );
}
