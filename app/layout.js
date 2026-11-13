import localFont from "next/font/local";
import "./globals.css";

// Fonts match genesis-lab: both families self-hosted from app/fonts/ via next/font/local.
// --font-google-sans → Google Sans (body / EN)
// --font-line-seed   → LINE Seed Sans TH (Thai + headings)
// (Not --font-en/--font-thai as in genesis-lab: in Tailwind v4 those names are
// the theme variables behind the font-en/font-thai utilities and would collide.)

const googleSans = localFont({
  src: [
    { path: "./fonts/GoogleSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/GoogleSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/GoogleSans-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/GoogleSans-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-google-sans",
  display: "swap",
});

const lineSeedSansTH = localFont({
  src: [
    { path: "./fonts/LINESeedSansTH_W_Th.woff2", weight: "100", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_Rg.woff2", weight: "400", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_Bd.woff2", weight: "700", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_He.woff2", weight: "800", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_XBd.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-line-seed",
  display: "swap",
});

export const metadata = {
  title: "9Expert Studio",
};

// Dark is the default: <html> is server-rendered with `dark`, so the first paint is
// dark even before (or without) JS. This script runs before paint and only an
// explicit stored "light" (localStorage key "theme", per device) removes it.
// Missing/invalid values and storage errors stay dark. No OS-preference fallback.
// Must stay in sync with components/shell/ThemeToggle.jsx.
const THEME_SCRIPT = `(function(){try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}})()`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="th"
      className={`dark ${googleSans.variable} ${lineSeedSansTH.variable} h-full antialiased`}
      // The theme script adds/removes `dark` before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
