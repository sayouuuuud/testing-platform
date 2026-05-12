import type { Metadata, Viewport } from "next"
import { Fraunces, Cairo, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

// Display — editorial serif with sharp character (variable font)
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-impl",
  display: "swap",
})

// Body — clean Arabic + Latin pairing (variable font)
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-sans-impl",
  display: "swap",
})

// Mono — for codes, numbers, labels (variable font)
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-impl",
  display: "swap",
})

export const metadata: Metadata = {
  title: "منصة التحقق | ITQ Testing",
  description: "منصة تتبع اختبارات المقرأة والأكاديمية — تحديث لحظي وتعاون مباشر",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF8F2" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" }
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${fraunces.variable} ${cairo.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased min-h-screen bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              },
            }}
          />
          {process.env.NODE_ENV === "production" && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
