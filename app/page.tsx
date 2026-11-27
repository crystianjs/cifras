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

interface ToastNotification {
  text: string
  type: 'success' | 'error' | 'info'
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

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<'admin' | 'convidado' | 'pendente' | 'bloqueado'>('pendente')
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [canImport, setCanImport] = useState(true)
  const [canShare, setCanShare] = useState(true)
  const [canSaveEdits, setCanSaveEdits] = useState(false)
  const [accessRequested, setAccessRequested] = useState(false)

  const [toast, setToast] = useState<ToastNotification | null>(null)
  
  // Estado para a cor das cifras (Padrão: Vermelho)
  const [chordColor, setChordColor] = useState<'text-red-600' | 'text-blue-600' | 'text-amber-500'>('text-red-600')

  const [songs, setSongs] = useState<Song[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)

  const [hasAccessToLocked, setHasAccessToLocked] = useState(false)
  const [hasRequestedAccess, setHasRequestedAccess] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [modalSearchTerm, setModalSearchTerm] = useState('')
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

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type })
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      setToast(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let mounted = true

    async function initApp() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        if (mounted) router.push('/login')
        return
      }

      const authUser = session.user
      if (mounted) setUser(authUser)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (prof && mounted) {
        setUserRole(prof.role)
        setCanImport(prof.can_import)
        setCanShare(prof.can_share)
        setAccessRequested(prof.access_requested || false)
      }

      if (mounted) {
        setIsLoadingAuth(false)
        loadUserData(authUser, prof?.role)
      }
    }

    initApp()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/login')
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setUser(session.user)
      }
    })

    const handleFS = () => setIsFullscreenActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFS)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('fullscreenchange', handleFS)
    }
  }, [router])

  async function loadUserData(authUser: any, role = userRole) {
    const { data: songsData } = await supabase.from('songs').select('*').order('title')
    const { data: albumsData } = await supabase.from('albums').select('*').order('name')

    if (songsData) setSongs(songsData)
    if (albumsData) setAlbums(albumsData)
    
    if (selectedAlbum && albumsData) {
      const updatedCurrentAlbum = albumsData.find(a => a.id === selectedAlbum.id)
      if (updatedCurrentAlbum) {
        setSelectedAlbum(updatedCurrentAlbum)
      }
    }

    if (songsData && songsData.length > 0 && !selectedSong) {
      handleSelectSong(songsData[0], authUser?.id, role)
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
      }, scrollSpeed * 30)
    }
    return () => clearInterval(interval)
  }, [isAutoScrolling, scrollSpeed])

  async function handleSelectSong(song: Song, userId = user?.id, currentRole = userRole) {
    setSelectedSong(song)
    initEditState(song)
    setMobileView('viewer')

    if (song.is_locked && currentRole !== 'admin') {
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
      const parts = line.split(/(\s+)/)
      return parts.map(part => {
        const chordRegex = /^([A-G][#b]?)(m|maj|min|dim|aug|sus|7M|M7|6|7|9|11|13)?(\d+)?(\/[A-G][#b]?)?$/
        if (chordRegex.test(part.trim())) {
          if (part.includes('/')) {
            const subparts = part.split('/')
            return `${transposeChord(subparts[0], semitones)}/${transposeChord(subparts[1], semitones)}`
          }
          return transposeChord(part, semitones)
        }
        return part
      }).join('')
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
      showToast('Preencha o título e o conteúdo da cifra.', 'error')
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
      showToast('Cifra importada e salva com sucesso.', 'success')
      setImportTitle('')
      setImportArtist('')
      setImportKey('C')
      setImportContent('')
      setIsImportModalOpen(false)
      loadUserData(user)
      if (data) handleSelectSong(data)
    } else {
      showToast('Não foi possível importar a cifra. Tente novamente.', 'error')
    }
  }

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault()
    if (userRole !== 'admin') {
      showToast('Apenas administradores podem criar álbuns.', 'error')
      return
    }

    const { error } = await supabase.from('albums').insert([
      { name: newAlbumName, description: newAlbumDesc, songs: [] }
    ])

    if (!error) {
      showToast('Álbum criado com sucesso.', 'success')
      setNewAlbumName('')
      setNewAlbumDesc('')
      setIsAlbumModalOpen(false)
      loadUserData(user)
    } else {
      showToast('Erro ao criar o álbum. Verifique os dados.', 'error')
    }
  }

  const handleToggleSongInAlbum = async (songId: string) => {
    if (!selectedAlbum || userRole !== 'admin') return
    const currentSongs = Array.isArray(selectedAlbum.songs) ? selectedAlbum.songs : []
    const isRemoving = currentSongs.includes(songId)
    const updatedSongs = isRemoving
      ? currentSongs.filter(id => id !== songId)
      : [...currentSongs, songId]

    const { error } = await supabase
      .from('albums')
      .update({ songs: updatedSongs })
      .eq('id', selectedAlbum.id)

    if (!error) {
      const updatedAlbumObj = { ...selectedAlbum, songs: updatedSongs }
      setSelectedAlbum(updatedAlbumObj)
      setAlbums(albums.map(a => a.id === updatedAlbumObj.id ? updatedAlbumObj : a))
      showToast(
        isRemoving ? 'Música removida do álbum.' : 'Música adicionada ao álbum.',
        'info'
      )
    } else {
      showToast('Não foi possível atualizar o álbum.', 'error')
    }
  }

  const handleRequestAccess = async () => {
    if (!selectedSong || !user) return
    const { error } = await supabase.from('song_access_requests').insert([
      { song_id: selectedSong.id, user_id: user.id, user_email: user.email }
    ])
    if (!error) {
      setHasRequestedAccess(true)
      showToast('Solicitação enviada ao administrador.', 'success')
    } else {
      showToast('Não foi possível enviar a solicitação.', 'error')
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
      showToast('Solicitação enviada. O administrador foi notificado.', 'success')
    }
  }

  const handleToggleLock = async () => {
    if (!selectedSong || userRole !== 'admin') return
    const newLockState = !selectedSong.is_locked
    const { error } = await supabase.from('songs').update({ is_locked: newLockState }).eq('id', selectedSong.id)
    if (!error) {
      setSelectedSong({ ...selectedSong, is_locked: newLockState })
      setSongs(songs.map(s => s.id === selectedSong.id ? { ...s, is_locked: newLockState } : s))
      showToast(
        newLockState ? 'Cifra bloqueada com cadeado.' : 'Cifra destrancada para visualização.',
        'info'
      )
    }
  }

  const handleDeleteSong = async () => {
    if (!selectedSong) return
    const isOwnerOrAdmin = userRole === 'admin' || selectedSong.user_id === user?.id
    if (!isOwnerOrAdmin) {
      showToast('Você não tem permissão para excluir esta cifra.', 'error')
      return
    }

    if (confirm(`Tem certeza que deseja excluir permanentemente a cifra "${selectedSong.title}"?`)) {
      const { error } = await supabase.from('songs').delete().eq('id', selectedSong.id)
      if (!error) {
        showToast('Cifra excluída permanentemente.', 'success')
        setSelectedSong(null)
        loadUserData(user)
        setMobileView('list')
      } else {
        showToast('Erro ao excluir a cifra.', 'error')
      }
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedSong) return
    const isOwnerOrAdmin = userRole === 'admin' || selectedSong.user_id === user?.id
    if (!isOwnerOrAdmin && !canSaveEdits) {
      showToast('Você não tem permissão para salvar alterações nesta cifra.', 'error')
      return
    }

    const { error } = await supabase.from('songs').update({ title: editTitle, artist: editArtist, key: editKey, content: editContent }).eq('id', selectedSong.id)
    if (!error) {
      showToast('Alterações na cifra salvas com sucesso.', 'success')
      setSelectedSong({ ...selectedSong, title: editTitle, artist: editArtist, key: editKey, content: editContent })
      setIsEditing(false)
      loadUserData(user)
    } else {
      showToast('Não foi possível salvar as alterações.', 'error')
    }
  }

  const handleFullscreen = () => {
    const elem = document.getElementById('pure-song-content')
    if (!elem) return
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const handleShareSong = () => {
    if (!selectedSong) return
    const url = `${window.location.origin}/share/${selectedSong.id}`
    navigator.clipboard.writeText(url)
    showToast('Link de compartilhamento copiado para a área de transferência.', 'success')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isLoadingAuth) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-gray-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#2D68C4] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-gray-600">Carregando repertório...</p>
        </div>
      </main>
    )
  }

  if (userRole === 'pendente' || userRole === 'bloqueado') {
    return (
      <main className="h-screen w-screen overflow-hidden bg-gray-100 flex items-center justify-center p-4 text-center font-sans">
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 max-w-md flex flex-col gap-4 items-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {userRole === 'pendente' ? 'Acesso Restrito' : 'Acesso Bloqueado'}
          </h2>
          <p className="text-sm text-gray-600">
            {userRole === 'pendente'
              ? 'Sua conta ainda não possui liberação total. Clique abaixo para notificar o administrador.'
              : 'Seu acesso ao sistema foi suspenso pelo administrador.'}
          </p>

          {userRole === 'pendente' && (
            <button
              onClick={handleRequestSystemAccess}
              disabled={accessRequested}
              className="bg-[#2D68C4] hover:bg-blue-700 text-white px-4 py-2.5 rounded text-sm font-bold transition disabled:opacity-50 shadow w-full"
            >
              {accessRequested ? 'Solicitação Enviada (Aguardando Administrador)' : 'Pedir Permissão ao Administrador'}
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

  const modalFilteredSongs = songs.filter(s => 
    s.title.toLowerCase().includes(modalSearchTerm.toLowerCase()) || 
    s.artist.toLowerCase().includes(modalSearchTerm.toLowerCase())
  )

  return (
    <main className="h-screen w-screen overflow-hidden bg-gray-100 text-gray-900 flex flex-col font-sans relative">
      
      {/* Notificação Flutuante (Toast de 5 segundos) */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full px-4 pointer-events-none">
          <div className={`p-3.5 rounded-xl shadow-lg border flex items-center gap-3 pointer-events-auto transition-all ${
            toast.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-[#2D68C4]'
          }`}>
            {toast.type === 'success' && (
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-5 h-5 text-[#2D68C4] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-xs font-bold flex-1">{toast.text}</span>
            <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 p-0.5" aria-label="Fechar aviso">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
            <button onClick={() => setIsAlbumModalOpen(true)} className="bg-white text-[#2D68C4] hover:bg-gray-50 px-2.5 py-1 rounded text-[11px] md:text-xs font-bold shadow transition flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              <span>Álbum</span>
            </button>
          )}
          {canImport && activeMenu === 'Scores' && (
            <button onClick={() => setIsImportModalOpen(true)} className="bg-white text-[#2D68C4] hover:bg-gray-50 px-2.5 py-1 rounded text-[11px] md:text-xs font-semibold shadow transition flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              <span>Importar</span>
            </button>
          )}
        </div>
      </header>

      {/* Sidebar Lateral Deslizante */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsSidebarOpen(false)} />
          <aside className="relative w-72 bg-white h-full shadow-2xl flex flex-col z-10 p-4 gap-4 overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="font-bold text-lg text-gray-800">Menu Principal</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-500 hover:text-gray-800 p-1" aria-label="Fechar Menu">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <nav className="flex flex-col gap-1">
              <button onClick={() => { setActiveMenu('Scores'); setSelectedAlbum(null); setIsSidebarOpen(false); }} className={`p-3 rounded text-left font-semibold text-sm transition ${activeMenu === 'Scores' ? 'bg-blue-50 text-[#2D68C4]' : 'hover:bg-gray-50'}`}>Cifras</button>
              <button onClick={() => { setActiveMenu('Albums'); setSelectedAlbum(null); setIsSidebarOpen(false); }} className={`p-3 rounded text-left font-semibold text-sm transition ${activeMenu === 'Albums' ? 'bg-blue-50 text-[#2D68C4]' : 'hover:bg-gray-50'}`}>Álbuns</button>
              
              {/* Seletor de Cores da Cifra */}
              <div className="p-2.5 mt-2 bg-gray-50 rounded-lg border flex flex-col gap-2">
                <p className="text-xs font-bold text-gray-500 uppercase px-1">Cor da Cifra</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button 
                    onClick={() => { setChordColor('text-red-600'); showToast('Cor padrão vermelha aplicada.', 'info'); }}
                    className={`p-2 rounded text-xs font-bold border transition ${chordColor === 'text-red-600' ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                  >
                    Vermelho
                  </button>
                  <button 
                    onClick={() => { setChordColor('text-blue-600'); showToast('Cor azul aplicada.', 'info'); }}
                    className={`p-2 rounded text-xs font-bold border transition ${chordColor === 'text-blue-600' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                  >
                    Azul
                  </button>
                  <button 
                    onClick={() => { setChordColor('text-amber-500'); showToast('Cor amarela aplicada.', 'info'); }}
                    className={`p-2 rounded text-xs font-bold border transition ${chordColor === 'text-amber-500' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                  >
                    Amarelo
                  </button>
                </div>
              </div>

              {userRole === 'admin' && (
                <button onClick={() => router.push('/permissoes')} className="mt-2 p-3 rounded text-left font-semibold text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span>Gerenciar Permissões</span>
                </button>
              )}
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
                <button onClick={() => setIsManageAlbumSongsOpen(true)} className="bg-[#2D68C4] hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold shrink-0 shadow-sm transition flex items-center gap-1" title="Gerenciar Músicas do Álbum">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  <span>Puxar</span>
                </button>
              )}
            </div>
            {activeMenu === 'Albums' && selectedAlbum && (
              <button onClick={() => setSelectedAlbum(null)} className="text-xs text-[#2D68C4] font-bold text-left hover:underline flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                <span>Voltar para lista de Álbuns</span>
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
                  Nenhum álbum disponível. {userRole === 'admin' ? 'Clique em "Álbum" no topo para criar.' : 'Aguarde a criação pelo administrador.'}
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
                  {activeMenu === 'Albums' && selectedAlbum ? 'Nenhuma música neste álbum ainda. Clique em "Puxar" acima.' : 'Nenhuma cifra encontrada.'}
                </div>
              )
            )}
          </div>
        </aside>

        {/* Visualizador Direito */}
        <section className={`flex-1 p-2 md:p-6 overflow-y-auto overflow-x-hidden bg-gray-50 flex justify-center ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
          {selectedSong ? (
            <div className="w-full max-w-4xl bg-white p-3 md:p-8 rounded-xl border shadow-sm h-fit flex flex-col">
              <div className="md:hidden mb-2">
                <button onClick={() => setMobileView('list')} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-3 py-1.5 rounded text-xs transition flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  <span>Voltar para Lista</span>
                </button>
              </div>

              {/* Verificação de Cadeado Segura */}
              {selectedSong.is_locked && userRole !== 'admin' && !hasAccessToLocked ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                  <svg className="w-12 h-12 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <h3 className="text-lg font-bold text-gray-800">Esta cifra está restrita pelo administrador</h3>
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

                      {/* Controles de Tom, Transposição e Rolagem Automática */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="bg-blue-50 text-[#2D68C4] border border-blue-200 text-xs px-2.5 py-1 rounded-full font-bold">
                          Tom: {selectedSong.key}
                        </span>
                        
                        <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs font-medium">
                          <span className="text-gray-600 mr-0.5">Transpor:</span>
                          <button onClick={() => handleTranspose(-1)} className="px-2 py-0.5 bg-white hover:bg-gray-50 border border-gray-300 rounded shadow-sm font-bold text-gray-700 transition">-</button>
                          <button onClick={() => handleTranspose(1)} className="px-2 py-0.5 bg-white hover:bg-gray-50 border border-gray-300 rounded shadow-sm font-bold text-gray-700 transition">+</button>
                        </div>

                        {/* Botão de Rolagem Automática e Velocidade com Ícones SVG */}
                        <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs font-medium">
                          <button 
                            onClick={() => setIsAutoScrolling(!isAutoScrolling)} 
                            className={`px-2.5 py-0.5 rounded font-bold text-white transition flex items-center gap-1 ${isAutoScrolling ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                          >
                            {isAutoScrolling ? (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                                <span>Pausar</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                <span>Rolagem</span>
                              </>
                            )}
                          </button>
                          <span className="text-gray-600 ml-1">Vel:</span>
                          <button onClick={() => setScrollSpeed(prev => Math.max(1, prev - 1))} className="px-1.5 py-0.5 bg-white hover:bg-gray-50 border border-gray-300 rounded font-bold text-gray-700" title="Mais Rápido">-</button>
                          <span className="font-mono font-bold text-gray-800">{scrollSpeed}</span>
                          <button onClick={() => setScrollSpeed(prev => Math.min(10, prev + 1))} className="px-1.5 py-0.5 bg-white hover:bg-gray-50 border border-gray-300 rounded font-bold text-gray-700" title="Mais Lento">+</button>
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

                  {/* Modo de Edição ou Visualização com aplicação da cor escolhida para os acordes */}
                  {isEditing ? (
                    <div className="fixed inset-0 z-50 bg-white p-4 md:p-8 flex flex-col gap-4 overflow-y-auto">
                      <div className="flex justify-between items-center border-b pb-3">
                        <h3 className="font-bold text-lg text-gray-800">Editando Cifra</h3>
                        <button onClick={() => setIsEditing(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-3 py-1.5 rounded text-xs transition flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                          <span>Fechar Editor</span>
                        </button>
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
                    <div 
                      id="pure-song-content" 
                      ref={scrollContainerRef} 
                      className="font-mono text-xs md:text-sm leading-relaxed overflow-y-auto max-h-[60vh] p-2 md:p-4 whitespace-pre-wrap break-words bg-white rounded-lg [&:fullscreen]:h-screen [&:fullscreen]:max-h-none [&:fullscreen]:w-screen [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:justify-start [&:fullscreen]:p-8 [&:fullscreen]:text-base"
                    >
                      <div className="hidden [&:fullscreen]:block mb-4 border-b pb-2">
                        <h2 className="text-xl font-bold">{selectedSong.title} - {selectedSong.artist} (Tom: {selectedSong.key})</h2>
                      </div>
                      {selectedSong.content.split('\n').map((line, idx) => {
                        const parts = line.split(/(\s+)/)
                        return (
                          <div key={idx} className={line.trim() === '' ? 'h-4' : ''}>
                            {line === '' ? '\u00A0' : parts.map((part, pIdx) => {
                              const chordRegex = /^([A-G][#b]?)(m|maj|min|dim|aug|sus|7M|M7|6|7|9|11|13)?(\d+)?(\/[A-G][#b]?)?$/
                              const isChord = chordRegex.test(part.trim())
                              return (
                                <span key={pIdx} className={isChord && part.trim() !== '' ? `${chordColor} font-bold` : 'text-gray-800'}>
                                  {part}
                                </span>
                              )
                            })}
                          </div>
                        )
                      })}
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

      {/* Modal para Gerenciar / Puxar Músicas para o Álbum */}
      {isManageAlbumSongsOpen && selectedAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full flex flex-col gap-4 max-h-[85vh]">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-800">Puxar Músicas para o Álbum</h3>
                <p className="text-xs text-gray-500">{selectedAlbum.name}</p>
              </div>
              <button onClick={() => { setIsManageAlbumSongsOpen(false); setModalSearchTerm(''); }} className="text-gray-500 hover:text-gray-800 p-1" aria-label="Fechar Modal">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

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
                      {isSelectedInAlbum ? 'Remover' : 'Adicionar'}
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
              <button type="button" onClick={() => setIsImportModalOpen(false)} className="text-gray-500 hover:text-gray-800 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
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

      {/* Modal para Criar Novo Álbum */}
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