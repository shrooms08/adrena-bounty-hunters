import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { WalletProvider } from "@/components/WalletProvider";
import { Wallpaper } from "@/components/layout/Wallpaper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bounty Hunters | Adrena Trading Competitions",
  description:
    "Complete trading challenges on Adrena. Claim bounties. First come, first served.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${robotoMono.variable}`}>
      <body className="min-h-screen text-light font-sans antialiased">
        <Wallpaper />
        <WalletProvider>
          <Navbar />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
