import type { Metadata } from "next";
import "@fontsource-variable/source-serif-4";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "./globals.css";
import Banner from "@/components/Banner";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Uplift Modeling for Profit-Optimal Marketing Targeting",
  description:
    "Empirical uplift modeling benchmark on the Kevin Hillstrom RCT dataset comparing S, T, and X-learners against naive response models with repeated resampled statistical rigor.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 font-sans selection:bg-teal-100 dark:selection:bg-teal-900/40">
        <Banner />
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 py-8 px-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Uplift Modeling &amp; Causal Targeting Benchmark
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Kevin Hillstrom MineThatData E-Mail Analytics Challenge &bull; 10 Repeated Resampled Splits
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <a
                href="https://github.com/ishaannaik2310/uplift"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
              >
                GitHub Repository
              </a>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <span className="tabular text-slate-400">N=64,000 RCT</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
