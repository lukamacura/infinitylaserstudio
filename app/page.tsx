import type { Metadata } from "next";
import HomeClient from "@/components/HomeClient";
import Hero from "@/components/Hero";
import BrandStory from "@/components/BrandStory";
import ServiceHighlights from "@/components/ServiceHighlights";
import StatsSection from "@/components/StatsSection";
import CostComparison from "@/components/CostComparison";
import FAQSection from "@/components/FAQSection";
import TeamSection from "@/components/TeamSection";
import SafetySection from "@/components/SafetySection";
import CommunitySection from "@/components/CommunitySection";
import LocationsSection from "@/components/LocationsSection";
import Footer from "@/components/Footer";
import WistiaVideo from "@/components/WistiaVideo";
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
      {/* Sections render on the server; only the interactive ones ship JS. */}
      <HomeClient>
        <Hero />
        <StatsSection />
        <CostComparison />
        <WistiaVideo />
        <ServiceHighlights />
        <BrandStory />
        <SafetySection />
        <TeamSection />
        <CommunitySection />
        <FAQSection />
        <LocationsSection />
        <Footer />
      </HomeClient>
    </>
  );
}
