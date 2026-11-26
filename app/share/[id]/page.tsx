'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { jsPDF } from 'jspdf'

interface Song {
  id: string
  title: string
  artist: string
  key: string
  content: string
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function transposeChord(chord: string, semitones: number): string {
  const match = chord.match(/^([A-G][#b]?)(.*)$/)
  if (!match) return chord
  let [, baseNote, modifier] = match
  const flatMap: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' }
  if (flatMap[baseNote]) baseNote = flatMap[baseNote]
  let index = NOTES.indexOf(baseNote)
  if (index === -1) return chord
  index = (index + semitones + 12) % 12
  return NOTES[index] + modifier
}

function isLineOfChords(line: string): boolean {
  const words = line.trim().split(/\s+/)
  return (
    words.length > 0 &&
    line.trim() !== '' &&
    words.every((word) =>
      /^[A-G][#b]?(?:m|maj|min|dim|aug|sus)?(?:\d+)?(?:\/[A-G][#b]?)?$/.test(word)
    )
  )
}

export default function SharedSongPage() {
  const params = useParams()
  const songId = params?.id as string

  const [song, setSong] = useState<Song | null>(null)
  const [originalSong, setOriginalSong] = useState<Song | null>(null)
  const [loading, setLoading] = useState(true)

  // Edição puramente local (em memória, sem persistência)
  const [isEditingLocal, setIsEditingLocal] = useState(false)
  const [isAutoScrolling, setIsAutoScrolling] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState(3)
  const [isFullscreenActive, setIsFullscreenActive] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!songId) return
    async function loadSharedSong() {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, key, content')
        .eq('id', songId)
        .single()

      if (!error && data) {
        setSong(data)
        setOriginalSong(data)
      }
      setLoading(false)
    }
    loadSharedSong()

    const handleFullscreenChange = () => setIsFullscreenActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [songId])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (isAutoScrolling && scrollContainerRef.current) {
      interval = setInterval(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += 1
          if (
            scrollContainerRef.current.scrollTop + scrollContainerRef.current.clientHeight >=
            scrollContainerRef.current.scrollHeight
          ) {
            setIsAutoScrolling(false)
          }
        }
      }, scrollSpeed * 25)
    }
    return () => clearInterval(interval)
  }, [isAutoScrolling, scrollSpeed])

  const handleTranspose = (semitones: number) => {
    if (!song) return
    const newKey = transposeChord(song.key || 'C', semitones)
    const transposedContent = song.content
      .split('\n')
      .map((line) => {
        if (isLineOfChords(line)) {
          return line.replace(
            /[A-G][#b]?(?:m|maj|min|dim|aug|sus)?(?:\d+)?(?:\/[A-G][#b]?)?/g,
            (match) => {
              if (match.includes('/')) {
                const parts = match.split('/')
                return `${transposeChord(parts[0], semitones)}/${transposeChord(parts[1], semitones)}`
              }
              return transposeChord(match, semitones)
            }
          )
        }
        return line
      })
      .join('\n')

    setSong({ ...song, key: newKey, content: transposedContent })
  }

  const handleResetChanges = () => {
    if (originalSong) {
      setSong(originalSong)
      setIsEditingLocal(false)
    }
  }

  const handleFullscreen = () => {
    const elem = document.getElementById('shared-viewer-container')
    if (!elem) return
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const handleDownloadPDF = () => {
    if (!song) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const marginLeft = 15
    const pageHeight = doc.internal.pageSize.getHeight()
    let y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(song.title || 'Sem título', marginLeft, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(90, 90, 90)
    doc.text(`${song.artist || 'Desconhecido'}  |  Tom: ${song.key || 'C'}`, marginLeft, y)
    y += 5
    doc.line(marginLeft, y, 195, y)
    y += 8

    doc.setFontSize(10.5)
    song.content.split('\n').forEach((line) => {
      if (y > pageHeight - 15) {
        doc.addPage()
        y = 20
      }
      if (isLineOfChords(line)) {
        doc.setFont('courier', 'bold')
        doc.setTextColor(220, 38, 38)
      } else {
        doc.setFont('courier', 'normal')
        doc.setTextColor(30, 30, 30)
      }
      doc.text(line === '' ? ' ' : line, marginLeft, y)
      y += 5
    })
    doc.save(`${song.title || 'cifra'}.pdf`)
  }

  const renderFormattedContent = (content: string) =>
    content.split('\n').map((line, index) => {
      if (isLineOfChords(line)) {
        return (
          <div key={index} className="text-red-600 font-bold font-mono tracking-wider whitespace-pre text-base leading-snug">
            {line === '' ? '\u00A0' : line}
          </div>
        )
      }
      return (
        <div key={index} className="text-gray-800 font-mono whitespace-pre text-sm leading-snug">
          {line === '' ? '\u00A0' : line}
        </div>
      )
    })

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-gray-500">Carregando cifra compartilhada...</div>
  }

  if (!song) {
    return <div className="h-screen flex items-center justify-center text-red-500 font-semibold">Cifra não encontrada ou link inválido.</div>
  }

  return (
    <main id="shared-viewer-container" className="min-h-screen bg-gray-100 flex flex-col font-sans">
      <header className="bg-[#2D68C4] text-white px-4 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">Meu Cifras</span>
          <span className="bg-amber-400 text-gray-900 text-[11px] font-bold px-2 py-0.5 rounded">
            Modo Leitura / Edição Temporária
          </span>
        </div>
        <a href="/login" className="text-xs bg-white text-[#2D68C4] px-3 py-1.5 rounded font-bold hover:bg-blue-50">
          Criar minha conta
        </a>
      </header>

      <div className="flex-1 p-3 md:p-6 flex justify-center">
        <div className="w-full max-w-4xl bg-white p-4 md:p-8 rounded-xl border border-gray-200 shadow-sm h-fit flex flex-col">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2 rounded mb-4">
            Você pode alterar o tom ou editar o texto livremente para tocar agora. <strong>Nenhuma alteração será salva no arquivo original.</strong>
          </div>

          <div className="border-b border-gray-200 pb-3 mb-3 flex flex-wrap justify-between items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              {isEditingLocal ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={song.title}
                    onChange={(e) => setSong({ ...song, title: e.target.value })}
                    className="border px-3 py-1.5 rounded text-lg font-bold text-gray-900 w-full"
                  />
                  <input
                    type="text"
                    value={song.artist}
                    onChange={(e) => setSong({ ...song, artist: e.target.value })}
                    className="border px-3 py-1.5 rounded text-sm text-gray-600 w-full"
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">{song.title}</h2>
                  <p className="text-gray-600 text-sm font-medium mt-0.5">{song.artist}</p>
                </>
              )}

              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                <span className="bg-blue-100 text-[#2D68C4] text-xs px-2.5 py-1 rounded-full font-semibold">
                  Tom: {song.key}
                </span>

                <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs">
                  <span className="text-gray-600 mr-0.5">Transpor:</span>
                  <button onClick={() => handleTranspose(-1)} className="px-2 py-0.5 bg-white rounded shadow-sm font-bold hover:bg-gray-200">-</button>
                  <button onClick={() => handleTranspose(1)} className="px-2 py-0.5 bg-white rounded shadow-sm font-bold hover:bg-gray-200">+</button>
                </div>

                {!isEditingLocal && (
                  <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded text-xs">
                    <button
                      onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                      className={`px-2 py-0.5 rounded font-bold text-white transition ${isAutoScrolling ? 'bg-red-600' : 'bg-green-600'}`}
                    >
                      {isAutoScrolling ? 'Parar' : 'Auto'}
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={scrollSpeed}
                      onChange={(e) => setScrollSpeed(Number(e.target.value))}
                      className="w-8 text-center border rounded py-0.5 bg-white"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setIsEditingLocal(!isEditingLocal)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded text-xs font-semibold transition"
              >
                {isEditingLocal ? 'Visualizar Cifra' : 'Editar na Tela'}
              </button>

              <button
                onClick={handleResetChanges}
                className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded text-xs font-semibold transition"
                title="Restaurar cifra original"
              >
                Restaurar Original
              </button>

              <button
                onClick={handleFullscreen}
                className="bg-gray-700 hover:bg-gray-800 text-white px-2.5 py-1.5 rounded text-xs font-semibold transition"
              >
                {isFullscreenActive ? 'Sair Tela' : 'Tela Cheia'}
              </button>

              <button
                onClick={handleDownloadPDF}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded text-xs font-semibold transition"
              >
                PDF
              </button>
            </div>
          </div>

          {isEditingLocal ? (
            <textarea
              value={song.content}
              onChange={(e) => setSong({ ...song, content: e.target.value })}
              className="w-full h-96 p-4 font-mono text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800"
            />
          ) : (
            <div
              ref={scrollContainerRef}
              className="bg-white p-2 rounded-lg leading-snug overflow-x-auto font-mono max-h-[62vh] overflow-y-auto border border-dashed border-gray-200"
            >
              {renderFormattedContent(song.content)}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}