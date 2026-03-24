import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { WalletProvider } from "@/components/WalletProvider";

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
    <html lang="en" className="dark">
      <body className="bg-grid min-h-screen bg-[#09090b]">
        <WalletProvider>
          <Navbar />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
