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

interface Album {
  id: string
  name: string
  description: string
  songs: string[]
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
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedArtistFilter, setSelectedArtistFilter] = useState('')
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState('Scores')

  // Controle explícito de visualização mobile: 'list' (mostra lista) ou 'viewer' (mostra cifra em tela cheia)
  const [mobileView, setMobileView] = useState<'list' | 'viewer'>('list')

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importMode, setImportMode] = useState<'online' | 'manual'>('online')
  
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState('')
  const [newAlbumDesc, setNewAlbumDesc] = useState('')
  const [isAddSongToAlbumOpen, setIsAddSongToAlbumOpen] = useState(false)
  const [songToAddId, setSongToAddId] = useState('')

  const [manualTitle, setManualTitle] = useState('')
  const [manualArtist, setManualArtist] = useState('')
  const [manualKey, setManualKey] = useState('C')
  const [manualContent, setManualContent] = useState('')
  
  const [cifraUrl, setCifraUrl] = useState('')
  const [isLoadingOnline, setIsLoadingOnline] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [editKey, setEditKey] = useState('')
  const [editContent, setEditContent] = useState('')

  const [isAutoScrolling, setIsAutoScrolling] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState(3)
  const [chordColor] = useState<'text-red-600' | 'text-blue-600' | 'text-green-600' | 'text-yellow-600'>('text-red-600')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchSongs()
    fetchAlbums()
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

  async function fetchAlbums(): Promise<void> {
    const { data, error } = await supabase.from('albums').select('*').order('name', { ascending: true })
    if (!error && data) {
      setAlbums(data)
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
    setMobileView('viewer') // Força a tela de visualização no celular
  }

  const handleBackToList = () => {
    setMobileView('list') // Retorna para a lista no celular
    setIsAutoScrolling(false)
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
    if (!cifraUrl) {
      alert('Insira uma URL válida.')
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

  const handleCreateAlbum = async () => {
    if (!newAlbumName) {
      alert('Dê um nome para o álbum.')
      return
    }
    const { error } = await supabase.from('albums').insert([
      { name: newAlbumName, description: newAlbumDesc, songs: [] }
    ])
    if (error) {
      alert('Erro ao criar álbum: ' + error.message)
    } else {
      alert('Álbum criado com sucesso!')
      setNewAlbumName('')
      setNewAlbumDesc('')
      setIsAlbumModalOpen(false)
      fetchAlbums()
    }
  }

  const handleAddSongToAlbum = async () => {
    if (!selectedAlbum || !songToAddId) return
    if (selectedAlbum.songs && selectedAlbum.songs.includes(songToAddId)) {
      alert('Esta música já está neste álbum.')
      return
    }

    const updatedSongs = [...(selectedAlbum.songs || []), songToAddId]
    const { error } = await supabase
      .from('albums')
      .update({ songs: updatedSongs })
      .eq('id', selectedAlbum.id)

    if (error) {
      alert('Erro ao adicionar música ao álbum: ' + error.message)
    } else {
      alert('Música adicionada ao álbum!')
      setSelectedAlbum({ ...selectedAlbum, songs: updatedSongs })
      setIsAddSongToAlbumOpen(false)
      fetchAlbums()
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
      setMobileView('list')
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

  const artistsList = Array.from(new Set(songs.map(s => s.artist))).filter(Boolean).sort()

  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          song.artist.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesArtist = selectedArtistFilter ? song.artist === selectedArtistFilter : true
    const matchesAlbum = activeMenu === 'Albums' && selectedAlbum 
      ? selectedAlbum.songs?.includes(song.id) 
      : true
    return matchesSearch && matchesArtist && matchesAlbum
  })

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
      <header className="bg-[#2D68C4] text-white px-4 md:px-6 py-3 flex justify-between items-center shadow-md shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-white hover:bg-blue-700 p-2 rounded-md transition focus:outline-none"
            title="Abrir Menu"
            aria-label="Abrir Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg md:text-xl font-bold tracking-wide">Meu Cifras</h1>
          
          <nav className="hidden md:flex items-center gap-1 ml-6">
            <button 
              onClick={() => { setActiveMenu('Scores'); setSelectedAlbum(null); }}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition ${activeMenu === 'Scores' ? 'bg-blue-700 text-white' : 'hover:bg-blue-600 text-blue-100'}`}
            >
              Cifras
            </button>
            <button 
              onClick={() => { setActiveMenu('Albums'); }}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition ${activeMenu === 'Albums' ? 'bg-blue-700 text-white' : 'hover:bg-blue-600 text-blue-100'}`}
            >
              Álbum
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {activeMenu === 'Albums' && (
            <button 
              onClick={() => setIsAlbumModalOpen(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded shadow text-xs md:text-sm font-semibold transition flex items-center gap-1"
            >
              <span>+ Novo Álbum</span>
            </button>
          )}
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white text-[#2D68C4] hover:bg-blue-50 px-3 md:px-4 py-1.5 md:py-2 rounded shadow cursor-pointer text-xs md:text-sm font-semibold transition flex items-center gap-1"
          >
            <span>+ Importar Cifra</span>
          </button>
        </div>
      </header>

      {/* Modal Criar Álbum */}
      {isAlbumModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden p-6 gap-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">Criar Novo Álbum / Repertório</h3>
              <button onClick={() => setIsAlbumModalOpen(false)} className="text-gray-500 font-bold">✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700">Nome do Álbum</label>
                <input 
                  type="text" 
                  value={newAlbumName} 
                  onChange={(e) => setNewAlbumName(e.target.value)} 
                  placeholder="Ex: Culto de Domingo..." 
                  className="w-full border px-3 py-2 rounded text-sm mt-1 text-gray-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Descrição</label>
                <textarea 
                  value={newAlbumDesc} 
                  onChange={(e) => setNewAlbumDesc(e.target.value)} 
                  placeholder="Detalhes ou observações..." 
                  className="w-full border px-3 py-2 rounded text-sm mt-1 text-gray-800"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setIsAlbumModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-semibold">Cancelar</button>
              <button onClick={handleCreateAlbum} className="px-4 py-2 bg-[#2D68C4] text-white rounded text-sm font-semibold hover:bg-blue-700">Criar Álbum</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Música ao Álbum */}
      {isAddSongToAlbumOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden p-6 gap-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">Adicionar Cifra ao Álbum</h3>
              <button onClick={() => setIsAddSongToAlbumOpen(false)} className="text-gray-500 font-bold">✕</button>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Selecione a Cifra</label>
              <select 
                value={songToAddId} 
                onChange={(e) => setSongToAddId(e.target.value)}
                className="w-full border px-3 py-2 rounded text-sm mt-1 text-gray-800 bg-white"
              >
                <option value="">-- Escolha uma música --</option>
                {songs.map(s => (
                  <option key={s.id} value={s.id}>{s.title} - {s.artist}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setIsAddSongToAlbumOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-semibold">Cancelar</button>
              <button onClick={handleAddSongToAlbum} className="px-4 py-2 bg-[#2D68C4] text-white rounded text-sm font-semibold hover:bg-blue-700">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar Cifra */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-[#2D68C4] text-white px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Importar / Adicionar Cifra</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-white hover:text-gray-200 font-bold text-lg">✕</button>
            </div>

            <div className="flex border-b bg-gray-50">
              <button 
                onClick={() => setImportMode('online')}
                className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${importMode === 'online' ? 'border-[#2D68C4] text-[#2D68C4] bg-white' : 'border-transparent text-gray-600 hover:bg-gray-100'}`}
              >
                Modo Online
              </button>
              <button 
                onClick={() => setImportMode('manual')}
                className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${importMode === 'manual' ? 'border-[#2D68C4] text-[#2D68C4] bg-white' : 'border-transparent text-gray-600 hover:bg-gray-100'}`}
              >
                Modo Manual
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {importMode === 'online' ? (
                <form onSubmit={handleFetchOnlineCifra} className="flex flex-col gap-4">
                  <p className="text-xs text-gray-500">Cole o link (URL) de sites compatíveis.</p>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">URL da Cifra</label>
                    <input 
                      type="url" 
                      placeholder="Ex: https://www.cifraclub.com.br/..." 
                      value={cifraUrl} 
                      onChange={(e) => setCifraUrl(e.target.value)} 
                      className="border px-3 py-2 rounded text-sm text-gray-800 font-mono"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-semibold">Cancelar</button>
                    <button 
                      type="submit" 
                      disabled={isLoadingOnline}
                      className="px-5 py-2 bg-[#2D68C4] text-white rounded text-sm font-semibold hover:bg-blue-700 shadow disabled:opacity-50"
                    >
                      {isLoadingOnline ? 'Buscando Cifra...' : 'Buscar Automaticamente'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-700">Título da Música</label>
                      <input type="text" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} className="border px-3 py-2 rounded text-sm text-gray-800" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-gray-700">Tom</label>
                      <input type="text" value={manualKey} onChange={(e) => setManualKey(e.target.value)} className="border px-3 py-2 rounded text-sm text-gray-800 text-center uppercase" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">Artista / Banda</label>
                    <input type="text" value={manualArtist} onChange={(e) => setManualArtist(e.target.value)} className="border px-3 py-2 rounded text-sm text-gray-800" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">Conteúdo da Cifra</label>
                    <textarea rows={8} value={manualContent} onChange={(e) => setManualContent(e.target.value)} className="border p-3 rounded text-xs font-mono text-gray-800" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-semibold">Cancelar</button>
                    <button onClick={handleSaveNewSong} className="px-5 py-2 bg-green-600 text-white rounded text-sm font-semibold shadow">Salvar Cifra</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drawer Menu Lateral */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsSidebarOpen(false)} />
          <aside className="relative w-72 bg-white h-full shadow-2xl flex flex-col z-10">
            <div className="bg-[#2D68C4] text-white p-6 flex flex-col gap-1">
              <h2 className="text-xl font-bold">Menu</h2>
              <span className="text-xs text-blue-200">Scores & Cifras</span>
            </div>
            <nav className="flex-1 py-4 overflow-y-auto space-y-1 px-3">
              <button
                onClick={() => { setActiveMenu('Scores'); setSelectedAlbum(null); setIsSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <span>Cifras</span>
              </button>
              <button
                onClick={() => { setActiveMenu('Albums'); setIsSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <span>Álbum</span>
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* Conteúdo Principal com Alternância Baseada no Estado mobileView */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Painel Esquerdo (Lista) */}
        <aside className={`w-full md:w-96 bg-white border-r border-gray-200 flex flex-col shadow-sm shrink-0 h-full ${mobileView === 'viewer' ? 'hidden md:flex' : 'flex'}`}>
          {activeMenu === 'Albums' && !selectedAlbum ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-gray-500">Seus Álbuns</span>
                <button onClick={() => setIsAlbumModalOpen(true)} className="text-xs text-[#2D68C4] font-bold">+ Novo</button>
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                {albums.map(album => (
                  <div key={album.id} onClick={() => setSelectedAlbum(album)} className="p-4 cursor-pointer hover:bg-blue-50 transition">
                    <h3 className="font-bold text-sm text-gray-800">{album.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{album.description || 'Sem descrição'}</p>
                    <span className="text-[10px] bg-blue-100 text-[#2D68C4] px-2 py-0.5 rounded-full mt-2 inline-block">
                      {album.songs?.length || 0} músicas
                    </span>
                  </div>
                ))}
                {albums.length === 0 && (
                  <div className="p-6 text-center text-gray-400 text-sm">Nenhum álbum criado.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-3 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
                {activeMenu === 'Albums' && selectedAlbum && (
                  <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-200">
                    <div>
                      <span className="text-xs text-blue-800 font-bold block">Álbum: {selectedAlbum.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setIsAddSongToAlbumOpen(true)} className="text-xs bg-[#2D68C4] text-white px-2 py-1 rounded font-semibold">+ Música</button>
                      <button onClick={() => setSelectedAlbum(null)} className="text-xs text-gray-600 hover:text-red-600 font-bold">Voltar</button>
                    </div>
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Pesquisar título ou artista..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2D68C4] text-gray-800"
                />
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-500 font-medium">Artista:</span>
                  <select 
                    value={selectedArtistFilter} 
                    onChange={(e) => setSelectedArtistFilter(e.target.value)}
                    className="flex-1 text-xs border rounded px-2 py-1 bg-white text-gray-800"
                  >
                    <option value="">Todos os Artistas</option>
                    {artistsList.map(artist => (
                      <option key={artist} value={artist}>{artist}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                {filteredSongs.map((song) => (
                  <div
                    key={song.id}
                    onClick={() => handleSelectSong(song)}
                    className={`p-3 md:p-4 cursor-pointer transition flex justify-between items-center ${
                      selectedSong?.id === song.id
                        ? 'bg-blue-50/85 border-l-4 border-[#2D68C4]'
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
            </div>
          )}
        </aside>

        {/* Painel Direito (Visualizador / Nova Página no Celular) */}
        <section id="song-viewer-container" className={`flex-1 p-3 md:p-6 overflow-y-auto bg-gray-50 flex justify-center h-full w-full ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
          {selectedSong ? (
            <div className="w-full max-w-4xl bg-white p-4 md:p-8 rounded-xl border border-gray-200 shadow-sm h-fit flex flex-col">
              
              {/* Botão Voltar exclusivo para telas menores */}
              <div className="md:hidden mb-3">
                <button 
                  onClick={handleBackToList}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Voltar</span>
                </button>
              </div>

              <div className="border-b border-gray-200 pb-4 mb-4 flex flex-wrap justify-between items-center gap-4">
                <div className="flex-1">
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="border px-3 py-1.5 rounded text-lg font-bold text-gray-900 w-full" />
                      <input type="text" value={editArtist} onChange={(e) => setEditArtist(e.target.value)} className="border px-3 py-1.5 rounded text-sm text-gray-600 w-full" />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900">{selectedSong.title}</h2>
                      <p className="text-gray-600 text-sm md:text-base font-medium mt-0.5">{selectedSong.artist}</p>
                    </>
                  )}

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="bg-blue-100 text-[#2D68C4] text-xs px-3 py-1 rounded-full font-semibold">
                      Tom: {isEditing ? <input type="text" value={editKey} onChange={(e) => setEditKey(e.target.value)} className="w-12 text-center border rounded ml-1 text-black" /> : selectedSong.key}
                    </span>

                    <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                      <span className="text-xs text-gray-600 mr-1">Transpor:</span>
                      <button onClick={() => handleTranspose(-1)} className="px-2.5 py-0.5 bg-white rounded shadow-sm text-xs font-bold hover:bg-gray-200">-</button>
                      <button onClick={() => handleTranspose(1)} className="px-2.5 py-0.5 bg-white rounded shadow-sm text-xs font-bold hover:bg-gray-200">+</button>
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded">
                        <button
                          onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                          className={`px-2 py-0.5 rounded text-xs font-bold text-white transition ${isAutoScrolling ? 'bg-red-600' : 'bg-green-600'}`}
                        >
                          {isAutoScrolling ? 'Parar' : 'Auto'}
                        </button>
                        <input type="number" min="1" max="10" value={scrollSpeed} onChange={(e) => setScrollSpeed(Number(e.target.value))} className="w-10 text-center text-xs border rounded py-0.5 bg-white" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <button onClick={handleSaveEdit} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-semibold">Salvar</button>
                      <button onClick={() => { setIsEditing(false); initEditState(selectedSong); }} className="bg-gray-300 text-gray-800 px-3 py-1.5 rounded text-xs font-semibold">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold">Editar</button>
                      <button onClick={handleFullscreen} className="bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-semibold hidden md:inline-block">Tela Cheia</button>
                      <button onClick={handleDownloadSong} className="bg-gray-800 text-white px-3 py-1.5 rounded text-xs font-semibold">Baixar</button>
                      <button 
                        onClick={handleDeleteSong} 
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1 shadow-sm"
                        title="Excluir Cifra"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Excluir</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-80 md:h-96 p-4 font-mono text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              ) : (
                <div 
                  ref={scrollContainerRef}
                  className="bg-white p-2 rounded-lg leading-snug overflow-x-auto font-mono max-h-[60vh] md:max-h-[55vh] overflow-y-auto border border-dashed border-gray-200"
                >
                  {renderFormattedContent(selectedSong.content)}
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400 p-6 text-center">
              <p className="text-sm md:text-base font-medium">Selecione uma cifra na lista</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}