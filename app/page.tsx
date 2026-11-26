'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

interface Song {
  id: string
  title: string
  artist: string
  key: string
  content: string
  is_locked?: boolean
  user_id?: string
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
  const flatMap: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' }
  if (flatMap[baseNote]) baseNote = flatMap[baseNote]
  let index = NOTES.indexOf(baseNote)
  if (index === -1) return chord
  index = (index + semitones + 12) % 12
  return NOTES[index] + modifier
}

function isLineOfChords(line: string): boolean {
  const words = line.trim().split(/\s+/)
  return words.length > 0 && line.trim() !== '' && words.every(word => /^[A-G][#b]?(?:m|maj|min|dim|aug|sus)?(?:\d+)?(?:\/[A-G][#b]?)?$/.test(word))
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<'admin' | 'convidado' | 'pendente' | 'bloqueado'>('pendente')
  const [canImport, setCanImport] = useState(true)
  const [canShare, setCanShare] = useState(true)
  const [canSaveEdits, setCanSaveEdits] = useState(false)
  const [accessRequested, setAccessRequested] = useState(false)

  const [songs, setSongs] = useState<Song[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)

  const [hasAccessToLocked, setHasAccessToLocked] = useState(false)
  const [hasRequestedAccess, setHasRequestedAccess] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [modalSearchTerm, setModalSearchTerm] = useState('') // Pesquisa independente para o modal de puxar músicas
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<'Scores' | 'Albums'>('Scores')
  const [mobileView, setMobileView] = useState<'list' | 'viewer'>('list')

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importTitle, setImportTitle] = useState('')
  const [importArtist, setImportArtist] = useState('')
  const [importKey, setImportKey] = useState('C')
  const [importContent, setImportContent] = useState('')

  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false)
  const [isManageAlbumSongsOpen, setIsManageAlbumSongsOpen] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState('')
  const [newAlbumDesc, setNewAlbumDesc] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [editKey, setEditKey] = useState('')
  const [editContent, setEditContent] = useState('')

  const [isAutoScrolling, setIsAutoScrolling] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState(3)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isFullscreenActive, setIsFullscreenActive] = useState(false)

  useEffect(() => {
    async function initApp() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      setUser(authUser)

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
      if (prof) {
        setUserRole(prof.role)
        setCanImport(prof.can_import)
        setCanShare(prof.can_share)
        setAccessRequested(prof.access_requested || false)
      }

      loadUserData(authUser, prof?.role)
    }
    initApp()

    const handleFS = () => setIsFullscreenActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFS)
    return () => document.removeEventListener('fullscreenchange', handleFS)
  }, [router])

  async function loadUserData(authUser: any, role = userRole) {
    let allowedSongsQuery = supabase.from('songs').select('*').order('title')
    let allowedAlbumsQuery = supabase.from('albums').select('*').order('name')

    if (authUser && role !== 'admin') {
      const { data: invites } = await supabase.from('album_invites').select('album_id, can_save_edits').eq('guest_email', authUser.email)
      const albumIds = invites?.map(i => i.album_id) || []
      const canSaveAny = invites?.some(i => i.can_save_edits) || false
      setCanSaveEdits(canSaveAny)

      allowedAlbumsQuery = supabase.from('albums').select('*').in('id', albumIds.length > 0 ? albumIds : ['00000000-0000-0000-0000-000000000000'])
    }

    const { data: songsData } = await allowedSongsQuery
    const { data: albumsData } = await allowedAlbumsQuery

    if (songsData) setSongs(songsData)
    if (albumsData) setAlbums(albumsData)
    
    if (selectedAlbum && albumsData) {
      const updatedCurrentAlbum = albumsData.find(a => a.id === selectedAlbum.id)
      if (updatedCurrentAlbum) {
        setSelectedAlbum(updatedCurrentAlbum)
      }
    }

    if (songsData && songsData.length > 0 && !selectedSong) {
      handleSelectSong(songsData[0], authUser?.id)
    }
  }

  useEffect(() => {
    let interval: any
    if (isAutoScrolling && scrollContainerRef.current) {
      interval = setInterval(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += 1
          if (scrollContainerRef.current.scrollTop + scrollContainerRef.current.clientHeight >= scrollContainerRef.current.scrollHeight) {
            setIsAutoScrolling(false)
          }
        }
      }, scrollSpeed * 25)
    }
    return () => clearInterval(interval)
  }, [isAutoScrolling, scrollSpeed])

  async function handleSelectSong(song: Song, userId = user?.id) {
    setSelectedSong(song)
    initEditState(song)
    setMobileView('viewer')

    if (song.is_locked && userRole !== 'admin') {
      const { data: grant } = await supabase.from('song_access_grants').select('*').eq('song_id', song.id).eq('user_id', userId).single()
      setHasAccessToLocked(!!grant)

      const { data: req } = await supabase.from('song_access_requests').select('*').eq('song_id', song.id).eq('user_id', userId).eq('status', 'pendente').single()
      setHasRequestedAccess(!!req)
    } else {
      setHasAccessToLocked(true)
    }
  }

  function initEditState(song: Song) {
    setEditTitle(song.title)
    setEditArtist(song.artist || '')
    setEditKey(song.key || 'C')
    setEditContent(song.content)
    setIsAutoScrolling(false)
  }

  const handleTranspose = (semitones: number) => {
    if (!selectedSong) return
    const currentKey = isEditing ? editKey : (selectedSong.key || 'C')
    const currentContent = isEditing ? editContent : selectedSong.content
    const newKey = transposeChord(currentKey, semitones)

    const transposedContent = currentContent.split('\n').map(line => {
      if (isLineOfChords(line)) {
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

  const handleDownloadPDF = () => {
    window.print()
  }

  const handleImportSong = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importTitle || !importContent) {
      alert('Preencha o título e o conteúdo da cifra.')
      return
    }

    const { data, error } = await supabase.from('songs').insert([
      {
        title: importTitle.trim(),
        artist: importArtist.trim() || 'Artista Desconhecido',
        key: importKey.trim().toUpperCase() || 'C',
        content: importContent,
        user_id: user?.id,
        is_locked: false
      }
    ]).select().single()

    if (!error) {
      alert('Cifra importada com sucesso!')
      setImportTitle('')
      setImportArtist('')
      setImportKey('C')
      setImportContent('')
      setIsImportModalOpen(false)
      loadUserData(user)
      if (data) handleSelectSong(data)
    } else {
      alert('Erro ao importar cifra: ' + error.message)
    }
  }

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault()
    if (userRole !== 'admin') {
      alert('Apenas administradores podem criar álbuns.')
      return
    }

    const { error } = await supabase.from('albums').insert([
      { name: newAlbumName, description: newAlbumDesc, songs: [] }
    ])

    if (!error) {
      alert('Álbum criado com sucesso!')
      setNewAlbumName('')
      setNewAlbumDesc('')
      setIsAlbumModalOpen(false)
      loadUserData(user)
    } else {
      alert('Erro ao criar álbum: ' + error.message)
    }
  }

  const handleToggleSongInAlbum = async (songId: string) => {
    if (!selectedAlbum || userRole !== 'admin') return
    const currentSongs = Array.isArray(selectedAlbum.songs) ? selectedAlbum.songs : []
    let updatedSongs: string[] = []

    if (currentSongs.includes(songId)) {
      updatedSongs = currentSongs.filter(id => id !== songId)
    } else {
      updatedSongs = [...currentSongs, songId]
    }

    const { error } = await supabase
      .from('albums')
      .update({ songs: updatedSongs })
      .eq('id', selectedAlbum.id)

    if (!error) {
      const updatedAlbumObj = { ...selectedAlbum, songs: updatedSongs }
      setSelectedAlbum(updatedAlbumObj)
      // Atualiza também na lista geral de álbuns para refletir imediatamente
      setAlbums(albums.map(a => a.id === updatedAlbumObj.id ? updatedAlbumObj : a))
    } else {
      alert('Erro ao atualizar músicas do álbum: ' + error.message)
    }
  }

  const handleRequestAccess = async () => {
    if (!selectedSong || !user) return
    const { error } = await supabase.from('song_access_requests').insert([
      { song_id: selectedSong.id, user_id: user.id, user_email: user.email }
    ])
    if (!error) {
      setHasRequestedAccess(true)
      alert('Solicitação enviada ao Administrador!')
    }
  }

  const handleRequestSystemAccess = async () => {
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ access_requested: true })
      .eq('id', user.id)

    if (!error) {
      setAccessRequested(true)
      alert('Solicitação enviada! O Administrador foi notificado.')
    }
  }

  const handleToggleLock = async () => {
    if (!selectedSong || userRole !== 'admin') return
    const newLockState = !selectedSong.is_locked
    const { error } = await supabase.from('songs').update({ is_locked: newLockState }).eq('id', selectedSong.id)
    if (!error) {
      setSelectedSong({ ...selectedSong, is_locked: newLockState })
      setSongs(songs.map(s => s.id === selectedSong.id ? { ...s, is_locked: newLockState } : s))
    }
  }

  const handleDeleteSong = async () => {
    if (!selectedSong) return
    const isOwnerOrAdmin = userRole === 'admin' || selectedSong.user_id === user?.id
    if (!isOwnerOrAdmin) {
      alert('Apenas o Administrador ou o autor podem excluir esta cifra.')
      return
    }

    if (confirm(`Tem certeza que deseja excluir permanentemente a cifra "${selectedSong.title}"?`)) {
      const { error } = await supabase.from('songs').delete().eq('id', selectedSong.id)
      if (!error) {
        alert('Cifra excluída com sucesso!')
        setSelectedSong(null)
        loadUserData(user)
        setMobileView('list')
      } else {
        alert('Erro ao excluir: ' + error.message)
      }
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedSong) return
    const isOwnerOrAdmin = userRole === 'admin' || selectedSong.user_id === user?.id
    if (!isOwnerOrAdmin && !canSaveEdits) {
      alert('Você não tem permissão para salvar alterações nesta cifra.')
      return
    }

    const { error } = await supabase.from('songs').update({ title: editTitle, artist: editArtist, key: editKey, content: editContent }).eq('id', selectedSong.id)
    if (!error) {
      alert('Cifra atualizada com sucesso!')
      setSelectedSong({ ...selectedSong, title: editTitle, artist: editArtist, key: editKey, content: editContent })
      setIsEditing(false)
      loadUserData(user)
    }
  }

  const handleFullscreen = () => {
    const elem = document.getElementById('song-viewer-container')
    if (!elem) return
    if (!document.fullscreenElement) elem.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  const handleShareSong = () => {
    if (!selectedSong) return
    const url = `${window.location.origin}/share/${selectedSong.id}`
    navigator.clipboard.writeText(url)
    alert('Link de compartilhamento copiado!')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (userRole === 'pendente' || userRole === 'bloqueado') {
    return (
      <main className="h-screen w-screen overflow-hidden bg-gray-100 flex items-center justify-center p-4 text-center font-sans">
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 max-w-md flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900">
            {userRole === 'pendente' ? 'Acesso Restrito' : 'Acesso Bloqueado'}
          </h2>
          <p className="text-sm text-gray-600">
            {userRole === 'pendente'
              ? 'Sua conta ainda não possui liberação total. Clique abaixo para notificar o Administrador.'
              : 'Seu acesso ao sistema foi suspenso pelo Administrador.'}
          </p>

          {userRole === 'pendente' && (
            <button
              onClick={handleRequestSystemAccess}
              disabled={accessRequested}
              className="bg-[#2D68C4] hover:bg-blue-700 text-white px-4 py-2.5 rounded text-sm font-bold transition disabled:opacity-50 shadow"
            >
              {accessRequested ? 'Solicitação Enviada (Aguardando Admin)' : 'Pedir Permissão ao Admin'}
            </button>
          )}

          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-red-600 font-semibold mt-1"
          >
            Sair ou trocar de conta
          </button>
        </div>
      </main>
    )
  }

  const filteredSongs = songs.filter(s => {
    const matchSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) || s.artist.toLowerCase().includes(searchTerm.toLowerCase())
    if (activeMenu === 'Albums' && selectedAlbum) {
      const albumSongIds = Array.isArray(selectedAlbum.songs) ? selectedAlbum.songs : []
      return matchSearch && albumSongIds.includes(s.id)
    }
    return matchSearch
  })

  // Lista de músicas filtrada exclusivamente pelo campo de busca do modal de "Puxar Músicas"
  const modalFilteredSongs = songs.filter(s => 
    s.title.toLowerCase().includes(modalSearchTerm.toLowerCase()) || 
    s.artist.toLowerCase().includes(modalSearchTerm.toLowerCase())
  )

  return (
    <main className="h-screen w-screen overflow-hidden bg-gray-100 text-gray-900 flex flex-col font-sans relative">
      
      {/* Navbar Superior */}
      <header className="bg-[#2D68C4] text-white px-3 md:px-4 py-2.5 flex flex-wrap justify-between items-center shadow-md shrink-0 z-20 gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSidebarOpen(true)} className="hover:bg-blue-700 p-1.5 rounded transition" aria-label="Abrir Menu">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-base md:text-lg font-bold">Meu Cifras</h1>
          
          <nav className="flex items-center gap-1 ml-2">
            <button 
              onClick={() => { setActiveMenu('Scores'); setSelectedAlbum(null); setMobileView('list'); }}
              className={`px-2.5 py-1 rounded text-xs md:text-sm font-bold transition ${activeMenu === 'Scores' ? 'bg-white text-[#2D68C4] shadow-sm' : 'text-blue-100 hover:bg-blue-600'}`}
            >
              Cifras
            </button>
            <button 
              onClick={() => { setActiveMenu('Albums'); setSelectedAlbum(null); setMobileView('list'); }}
              className={`px-2.5 py-1 rounded text-xs md:text-sm font-bold transition ${activeMenu === 'Albums' ? 'bg-white text-[#2D68C4] shadow-sm' : 'text-blue-100 hover:bg-blue-600'}`}
            >
              Álbuns
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 ml-auto md:ml-0">
          {userRole === 'admin' && activeMenu === 'Albums' && (
            <button onClick={() => setIsAlbumModalOpen(true)} className="bg-white text-[#2D68C4] hover:bg-gray-50 px-2.5 py-1 rounded text-[11px] md:text-xs font-bold shadow transition">
              + Álbum
            </button>
          )}
          {canImport && activeMenu === 'Scores' && (
            <button onClick={() => setIsImportModalOpen(true)} className="bg-white text-[#2D68C4] hover:bg-gray-50 px-2.5 py-1 rounded text-[11px] md:text-xs font-semibold shadow transition">
              + Importar
            </button>
          )}
        </div>
      </header>

      {/* Sidebar Lateral Deslizante */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsSidebarOpen(false)} />
          <aside className="relative w-72 bg-white h-full shadow-2xl flex flex-col z-10 p-4 gap-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="font-bold text-lg text-gray-800">Menu Principal</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="font-bold text-gray-500 hover:text-gray-800" aria-label="Fechar Menu">✕</button>
            </div>
            <nav className="flex flex-col gap-1">
              <button onClick={() => { setActiveMenu('Scores'); setSelectedAlbum(null); setIsSidebarOpen(false); }} className={`p-3 rounded text-left font-semibold text-sm transition ${activeMenu === 'Scores' ? 'bg-blue-50 text-[#2D68C4]' : 'hover:bg-gray-50'}`}>Cifras</button>
              <button onClick={() => { setActiveMenu('Albums'); setSelectedAlbum(null); setIsSidebarOpen(false); }} className={`p-3 rounded text-left font-semibold text-sm transition ${activeMenu === 'Albums' ? 'bg-blue-50 text-[#2D68C4]' : 'hover:bg-gray-50'}`}>Álbuns</button>
              {userRole === 'admin' && <button onClick={() => router.push('/permissoes')} className="p-3 rounded text-left font-semibold text-sm text-purple-700 hover:bg-purple-50 transition flex items-center gap-2">Gerenciar Permissões</button>}
            </nav>
            <div className="mt-auto pt-4 border-t">
              <button onClick={handleLogout} className="w-full bg-red-500 text-white py-2 rounded text-sm font-bold hover:bg-red-600 transition shadow-sm">Sair da Conta</button>
            </div>
          </aside>
        </div>
      )}

      {/* Corpo da Aplicação */}
      <div className="flex flex-1 overflow-hidden">
        {/* Painel Esquerdo */}
        <aside className={`w-full md:w-96 bg-white border-r flex flex-col ${mobileView === 'viewer' ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 bg-gray-50 border-b flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2D68C4]" />
              {activeMenu === 'Albums' && selectedAlbum && userRole === 'admin' && (
                <button onClick={() => setIsManageAlbumSongsOpen(true)} className="bg-[#2D68C4] hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold shrink-0 shadow-sm transition" title="Gerenciar Músicas do Álbum">
                  + Puxar Músicas
                </button>
              )}
            </div>
            {activeMenu === 'Albums' && selectedAlbum && (
              <button onClick={() => setSelectedAlbum(null)} className="text-xs text-[#2D68C4] font-bold text-left hover:underline">
                ← Voltar para lista de Álbuns
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y overflow-x-hidden">
            {activeMenu === 'Albums' && !selectedAlbum ? (
              albums.length > 0 ? (
                albums.map(alb => (
                  <div key={alb.id} onClick={() => setSelectedAlbum(alb)} className="p-4 cursor-pointer hover:bg-blue-50 flex justify-between items-center transition">
                    <div>
                      <h3 className="font-bold text-sm text-gray-800">{alb.name}</h3>
                      <p className="text-xs text-gray-500">{alb.description || 'Sem descrição'}</p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">Álbum</span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Nenhum álbum disponível. {userRole === 'admin' ? 'Clique em "+ Álbum" no topo.' : 'Aguarde um convite do Administrador.'}
                </div>
              )
            ) : (
              filteredSongs.length > 0 ? (
                filteredSongs.map(s => (
                  <div key={s.id} onClick={() => handleSelectSong(s)} className={`p-4 cursor-pointer flex justify-between items-center transition ${selectedSong?.id === s.id ? 'bg-blue-50 border-l-4 border-[#2D68C4]' : 'hover:bg-gray-50'}`}>
                    <div className="truncate pr-2">
                      <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-1.5 truncate">
                        {s.is_locked && (
                          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        )}
                        <span className="truncate">{s.title}</span>
                      </h3>
                      <p className="text-xs text-gray-500 truncate">{s.artist}</p>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono shrink-0 text-gray-600 font-semibold">{s.key}</span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">
                  {activeMenu === 'Albums' && selectedAlbum ? 'Nenhuma música neste álbum ainda. Clique em "+ Puxar Músicas" acima.' : 'Nenhuma cifra encontrada.'}
                </div>
              )
            )}
          </div>
        </aside>

        {/* Visualizador Direito */}
        <section id="song-viewer-container" className={`flex-1 p-2 md:p-6 overflow-y-auto overflow-x-hidden bg-gray-50 flex justify-center ${mobileView === 'list' ? 'hidden md:flex' : 'flex'} ${isFullscreenActive ? 'absolute inset-0 z-50 bg-white p-4 md:p-6' : ''}`}>
          {selectedSong ? (
            <div className="w-full max-w-4xl bg-white p-3 md:p-8 rounded-xl border shadow-sm h-fit flex flex-col">
              <div className="md:hidden mb-2">
                <button onClick={() => setMobileView('list')} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-3 py-1.5 rounded text-xs transition">
                  ← Voltar para Lista
                </button>
              </div>

              {/* Verificação de Cadeado para Convidados */}
              {selectedSong.is_locked && !hasAccessToLocked ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                  <svg className="w-12 h-12 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <h3 className="text-lg font-bold text-gray-800">Esta cifra está restrita pelo Administrador</h3>
                  <p className="text-xs text-gray-500 max-w-sm">Você precisa de autorização do administrador para visualizar o conteúdo desta música.</p>
                  <button onClick={handleRequestAccess} disabled={hasRequestedAccess} className="bg-[#2D68C4] hover:bg-blue-700 text-white px-5 py-2 rounded font-bold text-sm transition disabled:opacity-50 shadow-sm">
                    {hasRequestedAccess ? 'Solicitação Enviada (Aguardando)' : 'Solicitar Acesso ao Administrador'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="border-b pb-3 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2 truncate">
                        <span className="truncate">{selectedSong.title}</span>
                        {userRole === 'admin' && (
                          <button onClick={handleToggleLock} className="text-[11px] px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50 shrink-0 flex items-center gap-1 font-semibold text-gray-700 transition">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            {selectedSong.is_locked ? 'Trancada' : 'Destrancada'}
                          </button>
                        )}
                      </h2>
                      <p className="text-gray-600 text-xs md:text-sm truncate">{selectedSong.artist}</p>

                      {/* Controles de Tom e Transposição Unificados */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="bg-blue-50 text-[#2D68C4] border border-blue-200 text-xs px-2.5 py-1 rounded-full font-bold">
                          Tom: {selectedSong.key}
                        </span>
                        <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs font-medium">
                          <span className="text-gray-600 mr-0.5">Transpor:</span>
                          <button onClick={() => handleTranspose(-1)} className="px-2 py-0.5 bg-white hover:bg-gray-50 border border-gray-300 rounded shadow-sm font-bold text-gray-700 transition">-</button>
                          <button onClick={() => handleTranspose(1)} className="px-2 py-0.5 bg-white hover:bg-gray-50 border border-gray-300 rounded shadow-sm font-bold text-gray-700 transition">+</button>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button onClick={handleDownloadPDF} className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition">PDF</button>
                      <button onClick={handleFullscreen} className="bg-gray-700 hover:bg-gray-800 text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition">Tela Cheia</button>
                      {canShare && <button onClick={handleShareSong} className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition">Compartilhar</button>}
                      {(userRole === 'admin' || canSaveEdits) && (
                        <button onClick={() => setIsEditing(!isEditing)} className="bg-[#2D68C4] hover:bg-blue-700 text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition">
                          {isEditing ? 'Fechar' : 'Editar'}
                        </button>
                      )}
                      {(userRole === 'admin' || selectedSong.user_id === user?.id) && (
                        <button onClick={handleDeleteSong} className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition" title="Excluir Cifra">
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Modo de Edição */}
                  {isEditing ? (
                    <div className="fixed inset-0 z-50 bg-white p-4 md:p-8 flex flex-col gap-4 overflow-y-auto">
                      <div className="flex justify-between items-center border-b pb-3">
                        <h3 className="font-bold text-lg text-gray-800">Editando Cifra</h3>
                        <button onClick={() => setIsEditing(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-3 py-1.5 rounded text-xs transition">✕ Fechar Editor</button>
                      </div>
                      <div className="flex flex-col md:flex-row gap-3">
                        <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="border p-2.5 rounded text-sm font-bold flex-1 focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" placeholder="Título" />
                        <input type="text" value={editKey} onChange={(e) => setEditKey(e.target.value)} className="border p-2.5 rounded text-sm w-full md:w-28 text-center uppercase font-mono focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" placeholder="Tom" />
                      </div>
                      <input type="text" value={editArtist} onChange={(e) => setEditArtist(e.target.value)} className="border p-2.5 rounded text-sm focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" placeholder="Artista" />
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full flex-1 min-h-[50vh] p-4 font-mono text-xs md:text-sm border rounded focus:ring-2 focus:ring-[#2D68C4] focus:outline-none" placeholder="Conteúdo da cifra..." />
                      <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-semibold transition">Cancelar</button>
                        <button onClick={handleSaveEdit} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-bold shadow-sm transition">Salvar Alterações</button>
                      </div>
                    </div>
                  ) : (
                    <div ref={scrollContainerRef} className="font-mono text-xs md:text-sm leading-relaxed overflow-y-auto max-h-[60vh] p-1 md:p-2 whitespace-pre-wrap break-words">
                      {selectedSong.content.split('\n').map((line, idx) => (
                        <div key={idx} className={isLineOfChords(line) ? 'text-red-600 font-bold' : 'text-gray-800'}>
                          {line === '' ? '\u00A0' : line}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center text-gray-400">Selecione uma cifra ou álbum</div>
          )}
        </section>
      </div>

      {/* Modal para Gerenciar / Puxar Músicas para o Álbum (Com Campo de Pesquisa Independente) */}
      {isManageAlbumSongsOpen && selectedAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full flex flex-col gap-4 max-h-[85vh]">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-800">Puxar Músicas para o Álbum</h3>
                <p className="text-xs text-gray-500">{selectedAlbum.name}</p>
              </div>
              <button onClick={() => { setIsManageAlbumSongsOpen(false); setModalSearchTerm(''); }} className="font-bold text-gray-500 hover:text-gray-800" aria-label="Fechar Modal">✕</button>
            </div>

            {/* Campo de Busca específico do Modal */}
            <div>
              <input 
                type="text" 
                placeholder="Buscar música pelo nome ou artista..." 
                value={modalSearchTerm} 
                onChange={(e) => setModalSearchTerm(e.target.value)} 
                className="w-full border px-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2D68C4]" 
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y border rounded max-h-[45vh]">
              {modalFilteredSongs.map(song => {
                const isSelectedInAlbum = Array.isArray(selectedAlbum.songs) && selectedAlbum.songs.includes(song.id)
                return (
                  <div key={song.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition">
                    <div className="truncate pr-2">
                      <h4 className="font-semibold text-sm text-gray-800 truncate">{song.title}</h4>
                      <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                    </div>
                    <button
                      onClick={() => handleToggleSongInAlbum(song.id)}
                      className={`px-3 py-1 rounded text-xs font-bold transition shrink-0 ${isSelectedInAlbum ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-100 text-[#2D68C4] hover:bg-blue-200'}`}
                    >
                      {isSelectedInAlbum ? 'Remover' : '+ Adicionar'}
                    </button>
                  </div>
                )
              })}
              {modalFilteredSongs.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">
                  Nenhuma música encontrada com esse nome.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => { setIsManageAlbumSongsOpen(false); setModalSearchTerm(''); }} className="px-5 py-2 bg-[#2D68C4] hover:bg-blue-700 text-white rounded text-sm font-bold shadow-sm transition">Concluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Importar Cifra */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleImportSong} className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800">Importar Nova Cifra</h3>
              <button type="button" onClick={() => setIsImportModalOpen(false)} className="font-bold text-gray-500 hover:text-gray-800">✕</button>
            </div>
            <div className="flex gap-3 flex-col md:flex-row">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-700">Título da Música</label>
                <input type="text" required value={importTitle} onChange={(e) => setImportTitle(e.target.value)} placeholder="Ex: 10.000 Razões" className="w-full border px-3 py-2 rounded text-sm mt-1 focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" />
              </div>
              <div className="w-full md:w-32">
                <label className="text-xs font-bold text-gray-700">Tom Original</label>
                <input type="text" value={importKey} onChange={(e) => setImportKey(e.target.value)} placeholder="Ex: C" className="w-full border px-3 py-2 rounded text-sm mt-1 uppercase font-mono text-center focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Artista / Banda</label>
              <input type="text" value={importArtist} onChange={(e) => setImportArtist(e.target.value)} placeholder="Ex: Gabriela Rocha" className="w-full border px-3 py-2 rounded text-sm mt-1 focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Conteúdo (Cifra com Acordes)</label>
              <textarea required value={importContent} onChange={(e) => setImportContent(e.target.value)} placeholder="Cole o conteúdo da cifra aqui..." className="w-full h-48 border p-3 rounded font-mono text-xs mt-1 focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-semibold transition">Cancelar</button>
              <button type="submit" className="px-5 py-2 bg-[#2D68C4] hover:bg-blue-700 text-white rounded text-sm font-bold shadow-sm transition">Salvar e Importar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal para Criar Novo Álbum (Apenas Admin) */}
      {isAlbumModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleCreateAlbum} className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full flex flex-col gap-4">
            <h3 className="font-bold text-lg text-gray-800">Criar Novo Álbum</h3>
            <div>
              <label className="text-xs font-bold text-gray-700">Nome do Álbum</label>
              <input type="text" required value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} placeholder="Ex: Repertório Domingo" className="w-full border px-3 py-2 rounded text-sm mt-1 focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Descrição</label>
              <textarea value={newAlbumDesc} onChange={(e) => setNewAlbumDesc(e.target.value)} placeholder="Breve descrição do álbum..." className="w-full border px-3 py-2 rounded text-sm mt-1 h-20 focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsAlbumModalOpen(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-semibold transition">Cancelar</button>
              <button type="submit" className="px-5 py-2 bg-[#2D68C4] hover:bg-blue-700 text-white rounded text-sm font-bold shadow-sm transition">Criar Álbum</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}