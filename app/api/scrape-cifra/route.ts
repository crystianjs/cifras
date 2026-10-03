import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

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

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Não foi possível acessar a página da cifra.' }, { status: 400 })
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const title = $('h1.t1').first().text().trim() || $('h1').first().text().trim() || 'Sem Título'
    const htmlArtist = $('.art-link').first().text().trim() || $('.Cifra_artist').first().text().trim()
    const artist = htmlArtist && htmlArtist !== 'Desconhecido' ? htmlArtist : (urlArtist || 'Desconhecido')

    // Captura o tom real
    let rawKey = $('.cifra_tom').attr('data-tone') || 
                 $('.js-tone').first().text().trim() || 
                 $('.cifra_tom a').first().text().trim() || ''

    const contentContainer = $('.cifra_cnt').first()
    contentContainer.find('script, style').remove()

    let content = ''
    if (contentContainer.length > 0) {
      content = contentContainer.text().trim()
    } else {
      content = $('pre').first().text().trim()
    }

    if (!rawKey) {
      const matchChord = content.match(/\[Intro\]\s*([A-G][#b]?m?)/i) || content.trim().match(/^([A-G][#b]?m?)/)
      rawKey = matchChord ? matchChord[1] : 'C'
    }

    // FORÇA A CONVERSÃO: Se terminar com 'M' ou 'm', padroniza para minúsculo 'm'
    let key = rawKey.trim()
    if (key.endsWith('M')) {
      key = key.slice(0, -1) + 'm'
    }

    if (!title || !content) {
      return NextResponse.json({ error: 'Não foi possível extrair a cifra desta página.' }, { status: 400 })
    }

    return NextResponse.json({
      title,
      artist,
      key,
      content
    })

  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno ao processar a URL: ' + error.message }, { status: 500 })
  }
}