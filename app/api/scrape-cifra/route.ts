import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return NextResponse.json({ error: 'URL inválida. Insira um link válido.' }, { status: 400 })
    }

    // Extrai informações úteis da URL (ex: /simplificada/d/diante-do-trono/...)
    const urlObj = new URL(url)
    const urlSegments = urlObj.pathname.split('/').filter(Boolean)
    
    // Tenta adivinhar o artista ou nome da música pelas últimas partes da URL
    let defaultTitle = 'Sem Título'
    let defaultArtist = 'Desconhecido'

    if (urlSegments.length > 0) {
      // O último segmento costuma ser o nome da música
      const lastSegment = urlSegments[urlSegments.length - 1]
      defaultTitle = lastSegment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      // Se houver mais segmentos, tenta achar um artista provável
      if (urlSegments.length > 1) {
        // Geralmente o penúltimo ou antepenúltimo pode ser o artista
        const artistCandidate = urlSegments[urlSegments.length - 2]
        if (artistCandidate.length > 1 && artistCandidate !== 'simplificada' && artistCandidate !== 'cifra') {
          defaultArtist = artistCandidate
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        }
      }
    }

    let htmlContent = ''
    
    // Tenta via AllOrigins primeiro
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
      const res = await fetch(proxyUrl)
      if (res.ok) {
        const data = await res.json()
        htmlContent = data.contents || ''
      }
    } catch (e) {
      // Ignora erro do proxy
    }

    // Se falhar, tenta via Jina AI
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
        error: 'Este site possui proteção rígida contra leitura automática. Use a aba "Modo Manual" para colar a cifra instantaneamente.' 
      }, { status: 400 })
    }

    // Procura título no conteúdo markdown se houver
    let title = defaultTitle
    let artist = defaultArtist

    const lines = htmlContent.split('\n').map((l: string) => l.trim()).filter(Boolean)
    for (const line of lines.slice(0, 8)) {
      if (line.startsWith('# ')) {
        const cleanLine = line.replace('# ', '').trim()
        if (cleanLine.toLowerCase() !== 'home' && cleanLine.length > 2) {
          title = cleanLine
          break
        }
      }
    }

    // Detecta o tom básico se houver menção
    let key = 'C'
    const toneMatch = htmlContent.match(/(?:Tom|Tone|Key):\s*([A-G][#b]?m?)/i)
    if (toneMatch) {
      key = toneMatch[1]
      if (key.endsWith('M')) key = key.slice(0, -1) + 'm'
    }

    return NextResponse.json({
      title,
      artist,
      key,
      content: htmlContent
    })

  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno ao processar a URL: ' + error.message }, { status: 500 })
  }
}