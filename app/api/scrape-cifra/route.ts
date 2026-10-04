import { NextResponse } from 'next/server'

// Função auxiliar para formatar e alinhar a cifra de forma limpa
function formatarCifraAutomatica(rawContent: string): string {
  if (!rawContent) return ''

  // Se o conteúdo veio em Markdown do Jina, limpa tags desnecessárias
  let lines = rawContent.split('\n').map(l => l.trim())
  
  const linhasFormatadas: string[] = []
  let ultimoEraAcorde = false

  for (let i = 0; i < lines.length; i++) {
    let linha = lines[i]

    // Ignora linhas vazias repetidas excessivas
    if (!linha) {
      if (linhasFormatadas[linhasFormatadas.length - 1] !== '') {
        linhasFormatadas.push('')
      }
      continue
    }

    // Detecta se a linha é predominantemente composta por acordes (ex: A, D/F#, Bm7, G, C#m)
    // Uma linha de acorde geralmente tem palavras curtas separadas por espaços e sem pontuação longa
    const palavras = linha.split(/\s+/)
    const ehLinhaDeAcordes = palavras.length > 0 && palavras.every(p => 
      /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?(?:\/[A-G](?:#|b)?)?[0-9]*$/.test(p) || p === '|' || p === 'x'
    )

    if (ehLinhaDeAcordes) {
      // Garante espaçamento limpo entre os acordes
      linhasFormatadas.push(palavras.join('   '))
      ultimoEraAcorde = true
    } else {
      // Se a linha anterior era um acorde e esta é letra, adiciona um respiro se necessário
      if (ultimoEraAcorde && !linha.startsWith('[')) {
        // Mantém junto para o acorde ficar em cima da letra
      }
      linhasFormatadas.push(linha)
      ultimoEraAcorde = false
    }
  }

  return linhasFormatadas.join('\n').trim()
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return NextResponse.json({ error: 'URL inválida. Insira um link válido.' }, { status: 400 })
    }

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
    } catch (e) {}

    // Se falhar, tenta via Jina AI
    if (!htmlContent || htmlContent.length < 100 || htmlContent.includes('Cloudflare')) {
      const jinaUrl = `https://r.jina.ai/${url}`
      const jinaResponse = await fetch(jinaUrl, {
        headers: { 'Accept': 'application/json' }
      })
      if (jinaResponse.ok) {
        const jinaData = await jinaResponse.json()
        htmlContent = jinaData.data?.content || ''
      }
    }

    if (!htmlContent || htmlContent.length < 50 || htmlContent.includes('Cloudflare')) {
      return NextResponse.json({ 
        error: 'Este site possui proteção contra automação. Use o Modo Manual para colar a sua cifra com formatação perfeita.' 
      }, { status: 400 })
    }

    // Aplica a formatação inteligente para alinhar os acordes em cima e o texto embaixo
    const contentFormatted = formatarCifraAutomatica(htmlContent)

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
      content: contentFormatted
    })

  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno ao processar a URL: ' + error.message }, { status: 500 })
  }
}