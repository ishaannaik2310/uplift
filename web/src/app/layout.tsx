import type { Metadata } from "next";
import "./globals.css";
import Banner from "@/components/Banner";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Uplift Modeling for Profit-Optimal Marketing Targeting",
  description:
    "Empirical uplift modeling on the Kevin Hillstrom email dataset comparing S, T, and X-learners against naive response models with repeated resampled statistical rigor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
        <Banner />
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500">
          Uplift Modeling on Kevin Hillstrom MineThatData Dataset &bull; Empirical Evaluation &amp; Sensitivity Analysis
        </footer>
      </body>
    </html>
  );
}
