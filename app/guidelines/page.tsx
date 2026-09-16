import PublicInformation from "../components/public-information";
export const metadata = {
  title: "Usage guidelines · Plateworthy",
  description:
    "Use your own photos, review AI changes and publish accurate restaurant information.",
};
export default function Guidelines() {
  return (
    <PublicInformation
      title="Make work you can stand behind."
      intro="Practical guidelines for using Plateworthy."
    >
      <section>
        <h2>Use photos you have permission to use</h2>
        <p>
          Upload your own restaurant photos or material you have permission to
          upload, edit and publish. Do not assume that images found online,
          other restaurants’ photos, logos or people’s likenesses are free to
          use.
        </p>
        <p>
          The examples on the homepage demonstrate the product. Their stated
          licenses still apply; creating an account does not grant a separate
          license to use those example images in your restaurant’s marketing.
        </p>
      </section>
      <section>
        <h2>Review before sharing</h2>
        <p>
          AI results can contain mistakes. Confirm that food, portions,
          ingredients and packaging match your real dish. Review prices,
          availability, hours and captions yourself. Do not infer allergens,
          dietary safety or ingredient claims from an image.
        </p>
        <p>
          Approve the result before exporting it. Description-only images are
          illustrations and should not be presented as photographs of a dish you
          have not verified.
        </p>
      </section>
      <section>
        <h2>Commercial use and platform rules</h2>
        <p>
          The tools are intended to prepare restaurant menus and promotional
          materials. Your rights to the source material, any third-party rights,
          and the destination platform’s policies still apply. Plateworthy does
          not verify ownership, guarantee that AI output is exclusive, or
          guarantee acceptance by a delivery or social platform.
        </p>
      </section>
      <section>
        <h2>Keep access secure</h2>
        <p>
          Use a unique password and keep invitation, reset and staff-upload
          links private. Do not share another restaurant’s work, bypass usage
          limits or submit harmful or unlawful material.
        </p>
        <p>
          AI creation may pause while usage limits or service issues are
          addressed. Keep downloaded copies of work your restaurant relies on.
          See <a href="/pricing">plans and account information</a> for current
          help and account-access options.
        </p>
      </section>
    </PublicInformation>
  );
}
