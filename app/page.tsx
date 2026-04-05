import type { Metadata } from "next";
import HomeClient from "@/components/HomeClient";

export const metadata: Metadata = {
  title: "Laserska epilacija Beograd | Infinity Laser Studio",
  description:
    "Trajno uklanjanje dlaka laserskom epilacijom u Beogradu. Profesionalni tretmani, moderna oprema, medicinski tim. Zakaži besplatne konsultacije.",
  alternates: { canonical: "https://infinitylaserstudio.rs" },
  openGraph: {
    title: "Laserska epilacija Beograd | Infinity Laser Studio",
    description:
      "Trajno uklanjanje dlaka laserskom epilacijom u Beogradu. Profesionalni tretmani, moderna oprema, medicinski tim.",
    url: "https://infinitylaserstudio.rs",
  },
};

export default function Home() {
  return <HomeClient />;
}
