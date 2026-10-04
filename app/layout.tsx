import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Meu Cifras',
  description: 'Seu repertório de cifras e músicas',
  icons: {
    icon: '/favicon.svg', // Aponta para o arquivo que está dentro da pasta /public
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-100 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}