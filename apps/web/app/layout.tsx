import type { Metadata } from "next";
import { Instrument_Serif, Poppins } from "next/font/google";
import { WalletProvider } from "../providers/WalletProvider";
import { UmbraProvider } from "../providers/UmbraProvider";
import { Navbar } from "../components/Navbar";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${instrumentSerif.variable} ${poppins.variable} font-sans antialiased text-foreground bg-background`}>
        <WalletProvider>
          <UmbraProvider>
            <Navbar />
            {children}
          </UmbraProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
