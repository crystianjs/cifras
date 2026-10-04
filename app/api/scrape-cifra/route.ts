import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return NextResponse.json({ error: 'URL inválida. Insira um link válido.' }, { status: 400 })
    }

    // Extrai o Artista da URL se possível
    const urlObj = new URL(url)
    const urlParts = urlObj.pathname.split('/').filter(Boolean)
    let defaultArtist = ''
    if (urlParts.length >= 1) {
      defaultArtist = urlParts[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    // Estratégia de contorno: Utiliza múltiplos fallbacks de fetch (AllOrigins e Jina)
    let htmlContent = ''
    
    // Tenta primeiro via AllOrigins (bom para pegar o HTML cru)
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
      const res = await fetch(proxyUrl)
      if (res.ok) {
        const data = await res.json()
        htmlContent = data.contents || ''
      }
    } catch (e) {
      // Ignora e tenta o próximo
    }

    // Se o AllOrigins falhou ou veio vazio, tenta o Jina AI
    if (!htmlContent || htmlContent.length < 100) {
      const jinaUrl = `https://r.jina.ai/${url}`
      const jinaResponse = await fetch(jinaUrl, {
        headers: { 'Accept': 'application/json' }
      })
      if (jinaResponse.ok) {
        const jinaData = await jinaResponse.json()
        htmlContent = jinaData.data?.content || ''
      }
    }

    if (!htmlContent || htmlContent.length < 50) {
      return NextResponse.json({ 
        error: 'Este site possui proteção rígida contra leitura automática (Cloudflare). Use a aba "Modo Manual" para colar a cifra instantaneamente.' 
      }, { status: 400 })
    }

    // Limpa o conteúdo básico extraído
    let title = 'Sem Título'
    let artist = defaultArtist || 'Desconhecido'

    // Tenta extrair título das primeiras linhas se for markdown do Jina
    const lines = htmlContent.split('\n').map((l: string) => l.trim()).filter(Boolean)
    for (const line of lines.slice(0, 5)) {
      if (line.startsWith('# ')) {
        title = line.replace('# ', '').trim()
        break
      }
    }

    return NextResponse.json({
      title,
      artist,
      key: 'C',
      content: htmlContent
    })

  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno ao processar a URL: ' + error.message }, { status: 500 })
  }
}