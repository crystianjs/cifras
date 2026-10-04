import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return NextResponse.json({ error: 'URL inválida. Insira um link válido.' }, { status: 400 })
    }

    // Extrai informações úteis da URL para preencher título e artista automaticamente de forma limpa
    const urlObj = new URL(url)
    const urlSegments = urlObj.pathname.split('/').filter(Boolean)
    
    let defaultTitle = 'Sem Título'
    let defaultArtist = 'Desconhecido'

    if (urlSegments.length > 0) {
      const lastSegment = urlSegments[urlSegments.length - 1]
      defaultTitle = lastSegment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      if (urlSegments.length > 1) {
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
    
    // Tenta via AllOrigins
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
      const res = await fetch(proxyUrl)
      if (res.ok) {
        const data = await res.json()
        htmlContent = data.contents || ''
      }
    } catch (e) {
      // Ignora erro de rede do proxy
    }

    // Se falhar ou vier bloqueado, tenta via Jina AI Reader
    if (!htmlContent || htmlContent.length < 100 || htmlContent.includes('Cloudflare') || htmlContent.includes('Access Denied')) {
      const jinaUrl = `https://r.jina.ai/${url}`
      const jinaResponse = await fetch(jinaUrl, {
        headers: { 'Accept': 'application/json' }
      })
      if (jinaResponse.ok) {
        const jinaData = await jinaResponse.json()
        htmlContent = jinaData.data?.content || ''
      }
    }

    // Se o site de destino bloquear totalmente a leitura por segurança da nuvem, avisamos para usar o Modo Manual perfeitamente alinhado
    if (!htmlContent || htmlContent.length < 50 || htmlContent.includes('Cloudflare')) {
      return NextResponse.json({ 
        error: 'Este site possui proteção contra automação na nuvem. Use o Modo Manual para colar a sua cifra com formatação perfeita (acordes em cima, letra embaixo).' 
      }, { status: 400 })
    }

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