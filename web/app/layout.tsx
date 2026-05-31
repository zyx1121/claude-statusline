import type { Metadata } from "next";
import type { ComponentProps } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const REPO_URL = "https://github.com/zyx1121/claude-statusline";

export const metadata: Metadata = {
  title: "claude-statusline — a Claude-native, modular status line",
  description:
    "Browse the components of claude-statusline, a modular status line for Claude Code. Each component ships a README written for Claude to read, vet, and install.",
};

// lucide-react v1 dropped brand icons, so we ship our own GitHub mark.
function GitHubMark(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.31-.54-1.53.11-3.19 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.19.77.84 1.23 1.92 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <header className="border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="hover:text-foreground/80 font-mono text-sm font-semibold tracking-tight transition-colors"
            >
              claude-statusline
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Components
              </Link>
              <Link
                href="/spec"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Spec
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                aria-label="GitHub repository"
              >
                <GitHubMark className="size-4" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-border/60 border-t">
          <div className="text-muted-foreground mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs sm:flex-row sm:px-6">
            <p>
              MIT License &middot; built by{" "}
              <a
                href="https://github.com/zyx1121"
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground/80 hover:text-foreground font-medium transition-colors"
              >
                @zyx1121
              </a>
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            >
              <GitHubMark className="size-3.5" />
              github.com/zyx1121/claude-statusline
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
