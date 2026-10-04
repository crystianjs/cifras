import { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cifras',
  description: 'Seu gerenciador e visualizador de cifras e músicas',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#0f172a] text-slate-100 antialiased">{children}</body>
    </html>
  )
}