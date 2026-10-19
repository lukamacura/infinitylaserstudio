import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import FloatingBookingButton from "@/components/FloatingBookingButton";
import SocialProofToast from "@/components/SocialProofToast";
import { OG_BASE } from "@/lib/seo";
import { GOOGLE_ADS_ID } from "@/lib/googleAds";

// Self-hosted cuts of the Google Fonts originals (app/fonts). Google splits
// each weight into latin + latin-ext, so Serbian text (š/č/ć/ž/đ) cost two
// preloads per weight - 11 files, ~96 KB, all competing with the hero photo.
// Each file here is Google's latin set plus those 10 letters, in one file:
// 6 files, ~52 KB, the same glyphs and kerning. Made with fonttools:
//   pyftsubset <font>.ttf --flavor=woff2 --layout-features='*' --no-hinting
//     --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,
//       U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,
//       U+2212,U+2215,U+FEFF,U+FFFD,U+0106-0107,U+010C-010D,U+0110-0111,
//       U+0160-0161,U+017D-017E"
const dmSerif = localFont({
  variable: "--font-playfair",
  src: "./fonts/dm-serif-display-400.woff2",
  weight: "400",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const poppins = localFont({
  variable: "--font-poppins",
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  adjustFontFallback: "Arial",
});

// The hero's numbers (2000+, 5 god., 97%). One weight only - never put a bold
// class on it, the browser would fake it. The file holds only what those
// numbers need: 0-9 + % . , - – space and the letters g o d (2 KB instead of
// 15 KB). Any other letter falls back to a serif - re-cut it with --text= if
// the numbers ever change. next/font can't size a fallback from a file with
// no letters, so its fallback is declared in globals.css with Google's metrics.
const instrumentSerif = localFont({
  variable: "--font-instrument",
  src: "./fonts/instrument-serif-400.woff2",
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Instrument Serif Fallback"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.infinitylaserstudio.com"),
  title: {
    default: "Laserska epilacija Novi Sad i Sombor | Infinity Laser Studio",
    template: "%s | Infinity Laser Studio",
  },
  description:
    "Trajno uklanjanje dlaka laserskom epilacijom u Novom Sadu i Somboru. Profesionalni tretmani, moderna oprema, medicinski tim. Zakaži termin.",
  // The share picture is app/opengraph-image.jpg (square logo) - every page inherits it.
  openGraph: OG_BASE,
  twitter: {
    card: "summary",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#120A0E" };

const CLARITY_ID =
  process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_CLARITY_ID : undefined;
// Production only, so a test booking on localhost is never a Google Ads conversion.
const GADS_ID = process.env.NODE_ENV === "production" ? GOOGLE_ADS_ID : undefined;


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr-Latn" className="scroll-smooth">
      <head>
        {/* Meta Pixel + Clarity together cost ~0.6s of main-thread time on a
            mid-range phone, and the Google tag adds to that. Their command
            queues are set up immediately (so PageView and any early
            fbq/clarity/gtag calls are queued, not lost), but
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
              ${GADS_ID ? `w.dataLayer=w.dataLayer||[];w.gtag=function(){w.dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${GADS_ID}');` : ""}

              var done=false, evts=['scroll','pointerdown','keydown','touchstart'];
              function add(src){var t=d.createElement('script');t.async=true;t.src=src;d.head.appendChild(t);}
              function load(){
                if(done)return;done=true;
                evts.forEach(function(e){w.removeEventListener(e,load)});
                add('https://connect.facebook.net/en_US/fbevents.js');
                ${CLARITY_ID ? `add('https://www.clarity.ms/tag/${CLARITY_ID}');` : ""}
                ${GADS_ID ? `add('https://www.googletagmanager.com/gtag/js?id=${GADS_ID}');` : ""}
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