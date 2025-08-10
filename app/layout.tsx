import './globals.css'

export const metadata = {
  title: 'Board Game Sassy Sommelier - AI-Powered Game Recommendations',
  description: 'Get brutally honest, perfectly curated board game recommendations from your sassy AI sommelier. No BS, just games that actually match your vibe.',
  keywords: 'board games, game recommendations, AI sommelier, tabletop games, game curator',
  authors: [{ name: 'Board Game Sassy Sommelier' }],
  creator: 'Board Game Sassy Sommelier',
  openGraph: {
    title: 'Board Game Sassy Sommelier',
    description: 'Get brutally honest board game recommendations from your AI sommelier',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍷</text></svg>" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
