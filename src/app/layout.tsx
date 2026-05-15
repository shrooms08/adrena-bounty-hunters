import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
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
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          closeButton
          toastOptions={{
            className: "font-sans",
            style: {
              background: "#0c0a1d",
              color: "#f1f5f9",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            },
          }}
        />
      </body>
    </html>
  );
}
