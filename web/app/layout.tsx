import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "PD-Bench — Physical Design Benchmark",
  description:
    "A benchmark for evaluating AI agents on chip physical-design tasks. Launch agents, visualize placements, inspect scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1 w-full max-w-[1500px] mx-auto px-5 lg:px-8 py-7">
          {children}
        </main>
        <footer className="border-t border-line mt-10">
          <div className="max-w-[1500px] mx-auto px-5 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-3 text-ink-faint">
            <span className="label">PD-Bench · physical-design eval</span>
            <span className="tnum text-xs text-ink-faint">
              ariane133 · asap7 · openroad + cuda
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
