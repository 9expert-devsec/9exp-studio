import { Google_Sans, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const fontEn = Google_Sans({
  variable: "--font-en",
  subsets: ["latin"],
  display: "swap",
});

const fontTh = Noto_Sans_Thai({
  variable: "--font-th",
  subsets: ["thai"],
  display: "swap",
});

export const metadata = {
  title: "9Expert Studio",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="th"
      className={`${fontEn.variable} ${fontTh.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
