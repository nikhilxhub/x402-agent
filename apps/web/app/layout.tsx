import type { Metadata } from "next";
import { Instrument_Serif, Poppins } from "next/font/google";
import { WalletProvider } from "../providers/WalletProvider";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

const poppins = Poppins({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "AgentX402 Dapp",
  description: "Minimal Solana x402 client for paid AI prompts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${poppins.variable}`}
    >
      <body className="font-sans bg-white text-[#1a1a1a] antialiased">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
