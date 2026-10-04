import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Meu Cifras',
  description: 'Seu repertório de cifras e músicas',
  icons: {
    icon: '/icon.png', // ou '/icon.png' dependendo do nome do seu arquivo
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}