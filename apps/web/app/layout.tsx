import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { WalletProvider } from "../providers/WalletProvider";
import { Navbar } from "../components/Navbar";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
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
      <body className={`${instrumentSans.variable} font-sans antialiased text-foreground bg-background`}>
        <WalletProvider>
          <Navbar />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
