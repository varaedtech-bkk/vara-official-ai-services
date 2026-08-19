import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://varaedtech.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Sara — VARA EdTech AI Assistant',
  description:
    'Talk to Sara, the live AI assistant from VARA EdTech. Ask about our AI services, VR and AR work, and university partnerships.',
  applicationName: 'VARA EdTech AI Assistant',
  authors: [{ name: 'VARA EdTech Co., Ltd.', url: 'https://varaedtech.com' }],
  keywords: [
    'VARA EdTech',
    'AI assistant Thailand',
    'voice AI Bangkok',
    'Answer Engine Optimization',
    'VR AR education Thailand',
    'university AI partnership',
  ],
  icons: {
    icon: '/brand/vara-mark.png',
    apple: '/brand/vara-mark.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'VARA EdTech',
    title: 'Sara — VARA EdTech AI Assistant',
    description:
      'A live, bilingual AI assistant that knows VARA EdTech inside out. Speak to it now.',
    url: SITE_URL,
    images: [{ url: '/brand/vara-logo.png', width: 695, height: 421, alt: 'VARA EdTech' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sara — VARA EdTech AI Assistant',
    description: 'A live, bilingual AI assistant that knows VARA EdTech inside out.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#08070C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint, so a light-mode visitor
            never sees a dark flash on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('vara-theme')||'dark';" +
              "document.documentElement.setAttribute('data-theme',t);}catch(e){" +
              "document.documentElement.setAttribute('data-theme','dark');}",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
