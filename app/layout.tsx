import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Instrument_Serif, Poppins } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import FloatingBookingButton from "@/components/FloatingBookingButton";
import SocialProofToast from "@/components/SocialProofToast";
import { OG_BASE } from "@/lib/seo";

// Serbian š/č/ž/ć/đ live in latin-ext. The hero headline, its subtitle and the
// main button all contain them — preload that subset too, or the text
// re-paints late when it arrives.
const dmSerif = DM_Serif_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// The hero's numbers (2000+, 5 god., 97%). One weight only - never put a bold
// class on it, the browser would fake it.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.infinitylaserstudio.com"),
  title: {
    default: "Laserska epilacija Novi Sad i Sombor | Infinity Laser Studio",
    template: "%s | Infinity Laser Studio",
  },
  description:
    "Trajno uklanjanje dlaka laserskom epilacijom u Novom Sadu i Somboru. Profesionalni tretmani, moderna oprema, medicinski tim. Zakaži termin.",
  // The share picture is app/opengraph-image.jpg - every page inherits it.
  openGraph: OG_BASE,
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#120A0E" };

const CLARITY_ID =
  process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_CLARITY_ID : undefined;


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr-Latn" className="scroll-smooth">
      <head>
        {/* Meta Pixel + Clarity together cost ~0.6s of main-thread time on a
            mid-range phone. Their command queues are set up immediately (so
            PageView and any early fbq/clarity calls are queued, not lost), but
            the scripts themselves download only on the first interaction or
            5s after load — whichever comes first — keeping them out of the
            page's loading phase. */}
        <Script id="deferred-tracking" strategy="afterInteractive">
          {`
            (function(w,d){
              var n=w.fbq=w.fbq||function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!w._fbq)w._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=n.queue||[];
              fbq('init', '924353527086297');
              fbq('track', 'PageView');
              ${CLARITY_ID ? `w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};` : ""}

              var done=false, evts=['scroll','pointerdown','keydown','touchstart'];
              function add(src){var t=d.createElement('script');t.async=true;t.src=src;d.head.appendChild(t);}
              function load(){
                if(done)return;done=true;
                evts.forEach(function(e){w.removeEventListener(e,load)});
                add('https://connect.facebook.net/en_US/fbevents.js');
                ${CLARITY_ID ? `add('https://www.clarity.ms/tag/${CLARITY_ID}');` : ""}
              }
              evts.forEach(function(e){w.addEventListener(e,load,{once:true,passive:true})});
              function later(){setTimeout(load,5000)}
              if(d.readyState==='complete')later();else w.addEventListener('load',later);
            })(window,document);
          `}
        </Script>
      </head>
      <body
        className={`${dmSerif.variable} ${poppins.variable} ${instrumentSerif.variable} antialiased`}
      >
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
        <Navbar />
        <SocialProofToast />
{children}
        <FloatingBookingButton />
        <Analytics />
      </body>
    </html>
  );
}