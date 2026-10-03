import { LOCATIONS } from "./locations";

export const SITE_URL = "https://www.infinitylaserstudio.com";

/**
 * A page that sets its own `openGraph` replaces the layout's whole object -
 * including the image from app/opengraph-image.jpg - so every page spreads
 * this in to keep the site name, locale and share picture.
 */
export const OG_BASE = {
  type: "website",
  locale: "sr_RS",
  siteName: "Infinity Laser Studio",
  images: {
    url: "/opengraph-image.jpg",
    width: 1200,
    height: 1200,
    type: "image/jpeg",
    alt: "Infinity Laser Studio - laserska epilacija u Novom Sadu i Somboru",
  },
} as const;

const POSTAL_CODES: Record<string, string> = { novi_sad: "21000", sombor: "25000" };

/**
 * What Google reads about the business: the brand plus one entry per studio,
 * built from the same list the site shows its addresses from.
 */
export const businessSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Infinity Laser Studio",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      email: "ana.infinitystudio@gmail.com",
      telephone: ["+381653738991", "+381677747301"],
      sameAs: ["https://www.instagram.com/infinitylaserstudio/"],
    },
    ...LOCATIONS.map((loc) => ({
      "@type": "BeautySalon",
      "@id": `${SITE_URL}/#${loc.id}`,
      name: `Infinity Laser Studio ${loc.name}`,
      description: `Profesionalni studio za lasersku epilaciju ${loc.cityLocative}, osnovan od strane doktora medicine Dr Ane Kasap.`,
      url: SITE_URL,
      telephone: "+381653738991",
      ...(loc.image ? { image: `${SITE_URL}${loc.image}` } : {}),
      address: {
        "@type": "PostalAddress",
        ...(loc.address ? { streetAddress: loc.address } : {}),
        addressLocality: loc.name,
        postalCode: POSTAL_CODES[loc.id],
        addressCountry: "RS",
      },
      priceRange: "$$",
      parentOrganization: { "@id": `${SITE_URL}/#organization` },
    })),
  ],
};
