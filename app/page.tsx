'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

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
  const flatMap: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' }
  if (flatMap[baseNote]) baseNote = flatMap[baseNote]

  let index = NOTES.indexOf(baseNote)
  if (index === -1) return chord

  index = (index + semitones + 12) % 12
  return NOTES[index] + modifier
}

export default function Home(): React.JSX.Element {
  const [songs, setSongs] = useState<Song[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState('Scores')

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importMode, setImportMode] = useState<'manual' | 'online'>('manual')
  
  // Campos de Formulário
  const [manualTitle, setManualTitle] = useState('')
  const [manualArtist, setManualArtist] = useState('')
  const [manualKey, setManualKey] = useState('C')
  const [manualContent, setManualContent] = useState('')
  
  // Modo Online Automático (URL do Cifra Club)
  const [cifraUrl, setCifraUrl] = useState('')
  const [isLoadingOnline, setIsLoadingOnline] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [editKey, setEditKey] = useState('')
  const [editContent, setEditContent] = useState('')

  const [isAutoScrolling, setIsAutoScrolling] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState(3)
  const [chordColor, setChordColor] = useState<'text-red-600' | 'text-blue-600' | 'text-green-600' | 'text-yellow-600'>('text-red-600')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchSongs()
  }, [])

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

  async function fetchSongs(): Promise<void> {
    const { data, error } = await supabase.from('songs').select('*').order('title', { ascending: true })
    if (error) {
      console.error('Erro ao buscar cifras:', error)
    } else if (data) {
      setSongs(data)
      if (selectedSong) {
        const currentSelectedInDb = data.find(s => s.id === selectedSong.id)
        if (currentSelectedInDb) {
          setSelectedSong(currentSelectedInDb)
          if (!isEditing) initEditState(currentSelectedInDb)
        }
      } else if (data.length > 0) {
        setSelectedSong(data[0])
        initEditState(data[0])
      }
    }
  }

  function initEditState(song: Song) {
    setEditTitle(song.title)
    setEditArtist(song.artist || '')
    setEditKey(song.key || 'C')
    setEditContent(song.content)
    setIsAutoScrolling(false)
  }

  const handleSelectSong = (song: Song) => {
    setSelectedSong(song)
    initEditState(song)
    setIsEditing(false)
  }

  const handleSaveNewSong = async () => {
    if (!manualTitle || !manualContent) {
      alert('Preencha pelo menos o Título e o conteúdo da cifra.')
      return
    }

    const { error } = await supabase.from('songs').insert([
      { title: manualTitle, artist: manualArtist || 'Desconhecido', key: manualKey || 'C', content: manualContent }
    ])

    if (error) {
      alert('Erro ao salvar cifra: ' + error.message)
    } else {
      alert('Cifra salva com sucesso!')
      setIsImportModalOpen(false)
      setManualTitle('')
      setManualArtist('')
      setManualKey('C')
      setManualContent('')
      setCifraUrl('')
      fetchSongs()
    }
  }

  const handleFetchOnlineCifra = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cifraUrl || !cifraUrl.includes('cifraclub.com.br')) {
      alert('Insira uma URL válida do Cifra Club.')
      return
    }

    setIsLoadingOnline(true)
    try {
      const res = await fetch('/api/scrape-cifra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cifraUrl })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao buscar cifra online.')
      }

      setManualTitle(data.title)
      setManualArtist(data.artist)
      setManualKey(data.key)
      setManualContent(data.content)
      
      setImportMode('manual')
      alert(`Sucesso! Puxamos "${data.title}" de ${data.artist} (Tom: ${data.key}). Revise e clique em Salvar Cifra!`)
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setIsLoadingOnline(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedSong || !selectedSong.id) return

    const { error } = await supabase
      .from('songs')
      .update({ 
        title: editTitle, 
        artist: editArtist, 
        key: editKey, 
        content: editContent 
      })
      .eq('id', selectedSong.id)

    if (error) {
      alert('Erro ao salvar alterações: ' + error.message)
    } else {
      alert('Cifra atualizada com sucesso!')
      const updated: Song = { 
        ...selectedSong, 
        title: editTitle, 
        artist: editArtist, 
        key: editKey, 
        content: editContent 
      }
      setSelectedSong(updated)
      setIsEditing(false)
      fetchSongs()
    }
  }

  const handleDeleteSong = async () => {
    if (!selectedSong || !selectedSong.id) return
    if (!confirm(`Deseja realmente excluir "${selectedSong.title}"?`)) return

    const { error } = await supabase.from('songs').delete().eq('id', selectedSong.id)
    if (error) {
      alert('Erro ao excluir: ' + error.message)
    } else {
      alert('Cifra excluída com sucesso!')
      setSelectedSong(null)
      fetchSongs()
    }
  }

  const handleDownloadSong = () => {
    if (!selectedSong) return
    const element = document.createElement("a")
    const file = new Blob([isEditing ? editContent : selectedSong.content], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `${isEditing ? editTitle : selectedSong.title}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleFullscreen = () => {
    const elem = document.getElementById('song-viewer-container')
    if (!elem) return
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch((err) => {
        alert(`Erro ao tentar modo tela cheia: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  const handleTranspose = (semitones: number) => {
    if (!selectedSong) return

    const currentKey = isEditing ? editKey : (selectedSong.key || 'C')
    const currentContent = isEditing ? editContent : selectedSong.content

    const newKey = transposeChord(currentKey, semitones)

    const transposedContent = currentContent.split('\n').map(line => {
      const words = line.trim().split(/\s+/)
      const isChordLine = words.length > 0 && words.every(word => 
        /^[A-G][#b]?(?:m|maj|min|dim|aug|sus)?(?:\d+)?(?:\/[A-G][#b]?)?$/.test(word)
      ) && line.trim() !== ''

      if (isChordLine) {
        return line.replace(/[A-G][#b]?(?:m|maj|min|dim|aug|sus)?(?:\d+)?(?:\/[A-G][#b]?)?/g, match => {
          if (match.includes('/')) {
            const parts = match.split('/')
            return `${transposeChord(parts[0], semitones)}/${transposeChord(parts[1], semitones)}`
          }
          return transposeChord(match, semitones)
        })
      }
      return line
    }).join('\n')

    if (isEditing) {
      setEditKey(newKey)
      setEditContent(transposedContent)
    } else {
      const updated = { ...selectedSong, key: newKey, content: transposedContent }
      setSelectedSong(updated)
      setEditKey(newKey)
      setEditContent(transposedContent)
    }
  }

  const filteredSongs = songs.filter(song => 
    song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const renderFormattedContent = (content: string): React.JSX.Element[] => {
    return content.split('\n').map((line, index) => {
      const words = line.trim().split(/\s+/)
      const isChordLine = words.length > 0 && words.every(word => 
        /^[A-G][#b]?(?:m|maj|min|dim|aug|sus)?(?:\d+)?(?:\/[A-G][#b]?)?$/.test(word)
      ) && line.trim() !== ''

      if (isChordLine) {
        return (
          <div key={index} className={`${chordColor} font-bold font-mono tracking-wider whitespace-pre text-base leading-snug`}>
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
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-gray-100 text-gray-900 flex flex-col font-sans relative">
      
      {/* Navbar Superior */}
      <header className="bg-[#2D68C4] text-white px-6 py-3 flex justify-between items-center shadow-md shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-white hover:bg-blue-700 p-2 rounded-md transition focus:outline-none"
            title="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-bold tracking-wide">Scores & Cifras</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white text-[#2D68C4] hover:bg-blue-50 px-4 py-2 rounded shadow cursor-pointer text-sm font-semibold transition flex items-center gap-2"
          >
            <span>+ Adicionar / Importar Cifra</span>
          </button>
        </div>
      </header>

      {/* Modal de Importação com Modo Online Automático por URL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
            
            <div className="bg-[#2D68C4] text-white px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Adicionar Nova Cifra</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-white hover:text-gray-200 font-bold text-lg">✕</button>
            </div>

            <div className="flex border-b bg-gray-50">
              <button 
                onClick={() => setImportMode('online')}
                className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${importMode === 'online' ? 'border-[#2D68C4] text-[#2D68C4] bg-white' : 'border-transparent text-gray-600 hover:bg-gray-100'}`}
              >
                🌐 Modo Online (Colar URL Automático)
              </button>
              <button 
                onClick={() => setImportMode('manual')}
                className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${importMode === 'manual' ? 'border-[#2D68C4] text-[#2D68C4] bg-white' : 'border-transparent text-gray-600 hover:bg-gray-100'}`}
              >
                📝 Modo Manual / Revisão
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {importMode === 'online' ? (
                <form onSubmit={handleFetchOnlineCifra} className="flex flex-col gap-4">
                  <p className="text-xs text-gray-500">Cole o link (URL) oficial do Cifra Club abaixo. O sistema trará o título, o artista, o tom e a cifra preenchidos automaticamente!</p>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">URL do Cifra Club</label>
                    <input 
                      type="url" 
                      placeholder="Ex: https://www.cifraclub.com.br/get-worship/salva-me-o-deus/" 
                      value={cifraUrl} 
                      onChange={(e) => setCifraUrl(e.target.value)} 
                      className="border px-3 py-2 rounded text-sm text-gray-800 font-mono"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-semibold hover:bg-gray-300">Cancelar</button>
                    <button 
                      type="submit" 
                      disabled={isLoadingOnline}
                      className="px-5 py-2 bg-[#2D68C4] text-white rounded text-sm font-semibold hover:bg-blue-700 shadow disabled:opacity-50"
                    >
                      {isLoadingOnline ? 'Buscando Cifra...' : 'Buscar Cifra Automaticamente'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Revise os dados extraídos antes de salvar.</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-700">Título da Música</label>
                      <input 
                        type="text" 
                        value={manualTitle} 
                        onChange={(e) => setManualTitle(e.target.value)} 
                        className="border px-3 py-2 rounded text-sm text-gray-800"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-700">Tom</label>
                      <input 
                        type="text" 
                        value={manualKey} 
                        onChange={(e) => setManualKey(e.target.value)} 
                        className="border px-3 py-2 rounded text-sm text-gray-800 text-center uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">Artista / Banda</label>
                    <input 
                      type="text" 
                      value={manualArtist} 
                      onChange={(e) => setManualArtist(e.target.value)} 
                      className="border px-3 py-2 rounded text-sm text-gray-800"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">Conteúdo da Cifra</label>
                    <textarea 
                      rows={8} 
                      value={manualContent} 
                      onChange={(e) => setManualContent(e.target.value)} 
                      className="border p-3 rounded text-xs font-mono text-gray-800"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-semibold hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSaveNewSong} className="px-5 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 shadow">Salvar Cifra</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Menu Lateral Esquerdo */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={() => setIsSidebarOpen(false)} />
          <aside className="relative w-72 bg-white h-full shadow-2xl flex flex-col z-10">
            <div className="bg-[#2D68C4] text-white p-6 flex flex-col gap-1">
              <h2 className="text-xl font-bold">Guitar Pro</h2>
              <span className="text-xs text-blue-200">Gerenciador de Repertório</span>
            </div>
            <nav className="flex-1 py-4 overflow-y-auto divide-y divide-gray-100">
              <div className="space-y-1 px-3">
                {[
                  { name: 'Scores', icon: '🎵' },
                  { name: 'Albums', icon: '💿' },
                  { name: 'Artists', icon: '🎤' },
                  { name: 'Files', icon: '📁' },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => { setActiveMenu(item.name); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
                      activeMenu === item.name ? 'bg-blue-50 text-[#2D68C4]' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Painel Esquerdo */}
        <aside className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-sm shrink-0">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <input
              type="text"
              placeholder="Pesquisar por título ou artista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2D68C4] text-gray-800"
            />
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
            {filteredSongs.map((song) => (
              <div
                key={song.id}
                onClick={() => handleSelectSong(song)}
                className={`p-4 cursor-pointer transition flex justify-between items-center ${
                  selectedSong?.id === song.id
                    ? 'bg-blue-50/80 border-l-4 border-[#2D68C4]'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <h3 className={`font-semibold text-sm ${selectedSong?.id === song.id ? 'text-[#2D68C4]' : 'text-gray-800'}`}>
                    {song.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{song.artist}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                  {song.key || 'C'}
                </span>
              </div>
            ))}
            {filteredSongs.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">
                Nenhuma cifra encontrada.
              </div>
            )}
          </div>
        </aside>

        {/* Painel Direito */}
        <section id="song-viewer-container" className="flex-1 p-6 overflow-y-auto bg-gray-50 flex justify-center">
          {selectedSong ? (
            <div className="w-full max-w-4xl bg-white p-8 rounded-xl border border-gray-200 shadow-sm h-fit flex flex-col">
              
              <div className="border-b border-gray-200 pb-4 mb-6 flex flex-wrap justify-between items-center gap-4">
                <div className="flex-1">
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text" 
                        value={editTitle} 
                        onChange={(e) => setEditTitle(e.target.value)} 
                        className="border px-3 py-1.5 rounded text-lg font-bold text-gray-900 w-full" 
                        placeholder="Título da Música"
                      />
                      <input 
                        type="text" 
                        value={editArtist} 
                        onChange={(e) => setEditArtist(e.target.value)} 
                        className="border px-3 py-1.5 rounded text-sm text-gray-600 w-full" 
                        placeholder="Artista"
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedSong.title}</h2>
                      <p className="text-gray-600 text-base font-medium mt-1">{selectedSong.artist}</p>
                    </>
                  )}

                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <span className="bg-blue-100 text-[#2D68C4] text-xs px-3 py-1 rounded-full font-semibold">
                      Tom: {isEditing ? <input type="text" value={editKey} onChange={(e) => setEditKey(e.target.value)} className="w-12 text-center border rounded ml-1 text-black" /> : selectedSong.key}
                    </span>

                    <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                      <span className="text-xs text-gray-600 mr-1">Transpor:</span>
                      <button onClick={() => handleTranspose(-1)} className="px-2.5 py-0.5 bg-white rounded shadow-sm text-xs font-bold hover:bg-gray-200">-</button>
                      <button onClick={() => handleTranspose(1)} className="px-2.5 py-0.5 bg-white rounded shadow-sm text-xs font-bold hover:bg-gray-200">+</button>
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded">
                        <button
                          onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                          className={`px-3 py-0.5 rounded text-xs font-bold text-white transition ${isAutoScrolling ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                          {isAutoScrolling ? 'Parar Rolagem' : 'Auto-Rolagem'}
                        </button>
                        <span className="text-xs text-gray-600 ml-1">Velocidade:</span>
                        <input type="number" min="1" max="10" value={scrollSpeed} onChange={(e) => setScrollSpeed(Number(e.target.value))} className="w-12 text-center text-xs border rounded py-0.5 bg-white" />
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                        <span className="text-xs text-gray-600 mr-1">Cor:</span>
                        <button onClick={() => setChordColor('text-red-600')} className="w-4 h-4 rounded-full bg-red-600 border border-white shadow" title="Vermelho"></button>
                        <button onClick={() => setChordColor('text-blue-600')} className="w-4 h-4 rounded-full bg-blue-600 border border-white shadow" title="Azul"></button>
                        <button onClick={() => setChordColor('text-green-600')} className="w-4 h-4 rounded-full bg-green-600 border border-white shadow" title="Verde"></button>
                        <button onClick={() => setChordColor('text-yellow-600')} className="w-4 h-4 rounded-full bg-yellow-500 border border-white shadow" title="Amarelo"></button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <>
                      <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">Salvar</button>
                      <button onClick={() => { setIsEditing(false); initEditState(selectedSong); }} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">Editar</button>
                      <button onClick={handleFullscreen} className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">Tela Cheia</button>
                      <button onClick={handleDownloadSong} className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">Baixar .txt</button>
                      <button onClick={handleDeleteSong} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm" title="Excluir Cifra">🗑</button>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-96 p-4 font-mono text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              ) : (
                <div 
                  ref={scrollContainerRef}
                  className="bg-white p-2 rounded-lg leading-snug overflow-x-auto font-mono max-h-[55vh] overflow-y-auto pr-4 border border-dashed border-gray-200"
                >
                  {renderFormattedContent(selectedSong.content)}
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <p className="text-base font-medium">Selecione uma cifra na lista ao lado ou adicione uma nova</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}