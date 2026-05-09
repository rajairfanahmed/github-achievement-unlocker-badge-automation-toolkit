import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './styles.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : new URL('http://localhost:3000');

const description =
  'Local web dashboard and workflows for GitHub profile achievements: progress, rate limits, repository context, and badge runs.';

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'GitHub Achievement Manager',
    template: '%s · GitHub Achievement Manager',
  },
  description,
  applicationName: 'GitHub Achievement Manager',
  manifest: '/manifest.json',
  robots: process.env.NEXT_PUBLIC_SITE_URL
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
  openGraph: {
    title: 'GitHub Achievement Manager',
    description,
    type: 'website',
    url: siteUrl,
    siteName: 'GitHub Achievement Manager',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GitHub Achievement Manager',
    description,
  },
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d9488',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
