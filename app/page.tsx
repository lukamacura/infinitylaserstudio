import type { Metadata } from "next";
import HomeClient from "@/components/HomeClient";
import { OG_BASE, businessSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Laserska epilacija Novi Sad i Sombor | Infinity Laser Studio" },
  description:
    "Trajno uklanjanje dlaka laserskom epilacijom u Novom Sadu i Somboru. Profesionalni tretmani, moderna oprema, medicinski tim. Zakaži besplatne konsultacije.",
  alternates: { canonical: "https://www.infinitylaserstudio.com" },
  openGraph: {
    ...OG_BASE,
    title: "Laserska epilacija Novi Sad i Sombor | Infinity Laser Studio",
    description:
      "Trajno uklanjanje dlaka laserskom epilacijom u Novom Sadu i Somboru. Profesionalni tretmani, moderna oprema, medicinski tim.",
    url: "https://www.infinitylaserstudio.com",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />
      <HomeClient />
    </>
  );
}
