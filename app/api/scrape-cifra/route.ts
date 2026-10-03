import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || !url.includes('cifraclub.com.br')) {
      return NextResponse.json({ error: 'URL inválida do Cifra Club.' }, { status: 400 })
    }

    // Extrai o Artista direto da URL
    const urlParts = new URL(url).pathname.split('/').filter(Boolean)
    let urlArtist = ''
    if (urlParts.length >= 1) {
      urlArtist = urlParts[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    // Usando a API pública do JSDelivr/AllOrigins com parâmetros alternativos ou rotas de API do próprio Cifra Club se houver,
    // ou fallback inteligente estruturado para ignorar o bloqueio de Cloudflare simulando um Browser headless leve via fetch de mirror.
    // Como alternativa robusta definitiva, podemos usar o serviço "r.jina.ai" que extrai conteúdo limpo em markdown de qualquer URL protegida por Cloudflare!
    const jinaUrl = `https://r.jina.ai/${url}`
    const jinaResponse = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-With-Generated-Alt': 'true'
      }
    })

    if (!jinaResponse.ok) {
      return NextResponse.json({ error: 'Não foi possível contornar a segurança do Cifra Club. Tente colar a cifra manualmente.' }, { status: 400 })
    }

    const jinaData = await jinaResponse.json()
    const markdownContent = jinaData.data?.content || ''

    if (!markdownContent || markdownContent.length < 50) {
      return NextResponse.json({ error: 'O sistema de segurança bloqueou o conteúdo. Use a aba "Modo Manual / Revisão".' }, { status: 400 })
    }

    // Extrai Título e Artista do texto markdown retornado
    // O Jina AI costuma trazer o título no início
    const lines = markdownContent.split('\n').map((l: string) => l.trim()).filter(Boolean)
    let title = 'Sem Título'
    let artist = urlArtist || 'Desconhecido'

    for (const line of lines.slice(0, 5)) {
      if (line.startsWith('# ')) {
        title = line.replace('# ', '').trim()
        break
      }
    }

    // Tenta achar o tom no texto
    let key = 'C'
    const toneMatch = markdownContent.match(/(?:Tom|Tone):\s*([A-G][#b]?m?)/i) || markdownContent.match(/\b([A-G][#b]?m?)\b/)
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