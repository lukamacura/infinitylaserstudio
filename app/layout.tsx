import type { Metadata } from "next";
import { DM_Serif_Display, Poppins } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import FloatingBookingButton from "@/components/FloatingBookingButton";
import SocialProofToast from "@/components/SocialProofToast";

// The hero headline (the LCP element) contains š/č, which live in latin-ext —
// preload that subset too, or the headline re-paints late when it arrives.
const dmSerif = DM_Serif_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.infinitylaserstudio.com"),
  title: {
    default: "Laserska epilacija Novi Sad | Infinity Laser Studio",
    template: "%s | Infinity Laser Studio",
  },
  description:
    "Trajno uklanjanje dlaka laserskom epilacijom u Novom Sadu. Profesionalni tretmani, moderna oprema, medicinski tim. Zakaži termin.",
  openGraph: {
    type: "website",
    locale: "sr_RS",
    siteName: "Infinity Laser Studio",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Infinity Laser Studio — Laserska epilacija Novi Sad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
};

const CLARITY_ID =
  process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_CLARITY_ID : undefined;

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  name: "Infinity Laser Studio",
  description:
    "Profesionalni studio za lasersku epilaciju u Novom Sadu, osnovan od strane doktora medicine Dr Ane Kasap.",
  url: "https://www.infinitylaserstudio.com",
  telephone: "+381653738991",
  email: "ana.infinitystudio@gmail.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Novi Sad",
    addressCountry: "RS",
  },
  priceRange: "$$",
  sameAs: ["https://www.instagram.com/infinitylaserstudio/"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <Script id="meta-pixel" strategy="lazyOnload">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '924353527086297');
            fbq('track', 'PageView');
          `}
        </Script>
        {CLARITY_ID && (
          // lazyOnload = injected after window load, during browser idle time,
          // so it never competes with hydration, LCP or the booking flow.
          <Script id="ms-clarity" strategy="lazyOnload">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${CLARITY_ID}");
            `}
          </Script>
        )}
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=924353527086297&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>
      <body
        className={`${dmSerif.variable} ${poppins.variable} antialiased`}
      >
        <Navbar />
        <SocialProofToast />
{children}
        <FloatingBookingButton />
        <Analytics />
      </body>
    </html>
  );
}