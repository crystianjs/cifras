import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    // Validação genérica: aceita qualquer URL que comece com http ou https
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return NextResponse.json({ error: 'URL inválida. Insira um link válido.' }, { status: 400 })
    }

    // Extrai o domínio ou parte do nome para tentar inferir o artista/título se possível
    const urlObj = new URL(url)
    const urlParts = urlObj.pathname.split('/').filter(Boolean)
    let defaultArtist = ''
    if (urlParts.length >= 1) {
      defaultArtist = urlParts[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    // Utiliza o Jina AI Reader como proxy universal de extração em Markdown para contornar bloqueios de Cloudflare
    const jinaUrl = `https://r.jina.ai/${url}`
    const jinaResponse = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-With-Generated-Alt': 'true'
      }
    })

    if (!jinaResponse.ok) {
      return NextResponse.json({ error: 'Não foi possível extrair o conteúdo desta página. Tente colar a cifra manualmente.' }, { status: 400 })
    }

    const jinaData = await jinaResponse.json()
    const markdownContent = jinaData.data?.content || ''

    if (!markdownContent || markdownContent.length < 30) {
      return NextResponse.json({ error: 'O site de destino bloqueou a leitura automática. Use o modo manual.' }, { status: 400 })
    }

    // Extrai Título do Markdown se houver
    const lines = markdownContent.split('\n').map((l: string) => l.trim()).filter(Boolean)
    let title = 'Sem Título'
    let artist = defaultArtist || 'Desconhecido'

    for (const line of lines.slice(0, 5)) {
      if (line.startsWith('# ')) {
        title = line.replace('# ', '').trim()
        break
      }
    }

    // Detecta o tom de forma flexível
    let key = 'C'
    const toneMatch = markdownContent.match(/(?:Tom|Tone|Key):\s*([A-G][#b]?m?)/i) || markdownContent.match(/\b([A-G][#b]?m?)\b/)
    if (toneMatch) {
      key = toneMatch[1]
    }
    if (key.endsWith('M')) {
      key = key.slice(0, -1) + 'm'
    }

    return NextResponse.json({
      title,
      artist,
      key,
      content: markdownContent
    })

  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno ao processar a URL: ' + error.message }, { status: 500 })
  }
}