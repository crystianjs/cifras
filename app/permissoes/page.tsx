'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'convidado' | 'pendente' | 'bloqueado'
  can_import: boolean
  can_share: boolean
  access_requested?: boolean
}

interface AccessRequest {
  id: string
  song_id: string
  user_id: string
  user_email: string
  status: string
  songs?: { title: string }
}

interface SongAccessGrant {
  id: string
  song_id: string
  user_id: string
  user_email?: string
  songs?: { title: string }
}

interface Album {
  id: string
  name: string
}

interface ToastNotification {
  text: string
  type: 'success' | 'error' | 'info'
}

export default function PermissoesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'grants' | 'invites'>('users')
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [grants, setGrants] = useState<SongAccessGrant[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  
  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedAlbumId, setSelectedAlbumId] = useState('')
  const [canSaveEdits, setCanSaveEdits] = useState(false)
  const [loading, setLoading] = useState(true)

  const [toast, setToast] = useState<ToastNotification | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'convidado'>('convidado')
  const [creatingUser, setCreatingUser] = useState(false)

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
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/login'); return }

      const { data: myProf } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (myProf?.role !== 'admin') {
        router.push('/')
        return
      }

      loadData()
    }
    init()
  }, [router])

  async function loadData() {
    setLoading(true)
    const { data: profs } = await supabase.from('profiles').select('*').order('email')
    if (profs) setProfiles(profs)

    const { data: pendReqs } = await supabase
      .from('song_access_requests')
      .select('*, songs(title)')
      .eq('status', 'pendente')
    if (pendReqs) setRequests(pendReqs)

    const { data: activeGrants } = await supabase
      .from('song_access_grants')
      .select('id, song_id, user_id, songs(title)') as { data: any[] | null }
    
    if (activeGrants && profs) {
      const grantsWithEmail = activeGrants.map((g: any) => {
        const foundProf = (profs as any[]).find(p => p.id === g.user_id)
        return { ...g, user_email: foundProf?.email || 'Usuário' }
      })
      setGrants(grantsWithEmail)
    }

    const { data: albs } = await supabase.from('albums').select('id, name').order('name')
    if (albs) setAlbums(albs)

    setLoading(false)
  }

  const handleUpdateRole = async (id: string, role: string) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (!error) {
      showToast('Status do usuário atualizado.', 'success')
      loadData()
    }
  }

  const handleTogglePerm = async (id: string, field: string, val: boolean) => {
    const { error } = await supabase.from('profiles').update({ [field]: !val }).eq('id', id)
    if (!error) {
      showToast('Permissão atualizada.', 'info')
      loadData()
    }
  }

  const handleResolveRequest = async (reqId: string, songId: string, userId: string, approve: boolean) => {
    if (approve) {
      await supabase.from('song_access_grants').insert([{ song_id: songId, user_id: userId }])
      await supabase.from('song_access_requests').update({ status: 'aprovado' }).eq('id', reqId)
      showToast('Acesso à cifra aprovado.', 'success')
    } else {
      await supabase.from('song_access_requests').update({ status: 'recusado' }).eq('id', reqId)
      showToast('Solicitação recusada.', 'info')
    }
    loadData()
  }

  const handleRevokeGrant = async (grantId: string) => {
    if (confirm('Tem certeza que deseja bloquear o acesso deste usuário a esta cifra?')) {
      const { error } = await supabase.from('song_access_grants').delete().eq('id', grantId)
      if (!error) {
        showToast('Acesso à cifra bloqueado com sucesso.', 'success')
        loadData()
      } else {
        showToast('Erro ao bloquear acesso.', 'error')
      }
    }
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (confirm(`Tem certeza que deseja remover o usuário ${userEmail}?`)) {
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (!error) {
        showToast('Usuário removido do sistema.', 'success')
        loadData()
      } else {
        showToast('Não foi possível remover o usuário.', 'error')
      }
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserEmail || !newUserPassword) {
      showToast('Preencha o e-mail e a senha temporária.', 'error')
      return
    }

    setCreatingUser(true)

    const tempSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data, error } = await tempSupabase.auth.signUp({
      email: newUserEmail.trim(),
      password: newUserPassword,
      options: { data: { role: newUserRole } }
    })

    if (error) {
      showToast('Erro ao criar usuário. Verifique o e-mail ou tente mais tarde.', 'error')
    } else {
      if (data.user) {
        await supabase.from('profiles').update({ role: newUserRole }).eq('id', data.user.id)
      }
      showToast(`Usuário ${newUserEmail} cadastrado e pronto para acesso.`, 'success')
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserRole('convidado')
      setIsModalOpen(false)
      loadData()
    }
    setCreatingUser(false)
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail || !selectedAlbumId) {
      showToast('Preencha o e-mail e selecione o álbum.', 'error')
      return
    }

    const { error } = await supabase.from('album_invites').insert([
      { album_id: selectedAlbumId, guest_email: inviteEmail.trim(), can_save_edits: canSaveEdits }
    ])

    if (!error) {
      showToast(`Convite enviado para ${inviteEmail}.`, 'success')
      setInviteEmail('')
      setSelectedAlbumId('')
      setCanSaveEdits(false)
    } else {
      showToast('Não foi possível enviar o convite.', 'error')
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-gray-600">Carregando painel administrativo...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 flex flex-col font-sans relative">
      
      {/* Notificação Flutuante (Toast de 5 segundos) */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full px-4 pointer-events-none">
          <div className={`p-3.5 rounded-xl shadow-lg border flex items-center gap-3 pointer-events-auto transition-all ${
            toast.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-700'
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
              <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Header com tom Vermelho Profissional */}
      <header className="bg-red-600 text-white px-6 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Voltar para Cifras</span>
          </button>
          <h1 className="text-xl font-bold">Painel do Administrador</h1>
        </div>
      </header>

      {/* Abas com destaque em Vermelho */}
      <div className="bg-white border-b border-gray-200 px-6 flex justify-between items-center flex-wrap gap-2">
        <div className="flex gap-4 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('users')} 
            className={`py-3 text-sm font-bold border-b-2 whitespace-nowrap ${activeTab === 'users' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500'}`}
          >
            Gerenciar Usuários ({profiles.length})
          </button>
          <button 
            onClick={() => setActiveTab('requests')} 
            className={`py-3 text-sm font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'requests' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500'}`}
          >
            <span>Solicitações de Cadeado</span>
            {requests.length > 0 && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full">{requests.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('grants')} 
            className={`py-3 text-sm font-bold border-b-2 whitespace-nowrap ${activeTab === 'grants' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500'}`}
          >
            Acessos Liberados (Bloquear)
          </button>
          <button 
            onClick={() => setActiveTab('invites')} 
            className={`py-3 text-sm font-bold border-b-2 whitespace-nowrap ${activeTab === 'invites' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500'}`}
          >
            Convidar para Álbuns
          </button>
        </div>

        {activeTab === 'users' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded shadow transition flex items-center gap-1.5 my-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Novo Usuário</span>
          </button>
        )}
      </div>

      <div className="max-w-5xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <th className="p-4">E-mail</th>
                  <th className="p-4">Cargo / Status</th>
                  <th className="p-4 text-center">Importar</th>
                  <th className="p-4 text-center">Compartilhar</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {profiles.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                        <span>{p.email}</span>
                        {p.access_requested && p.role === 'pendente' && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                            Pediu Acesso
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <select 
                        value={p.role} 
                        onChange={(e) => handleUpdateRole(p.id, e.target.value)} 
                        className={`border px-2 py-1 rounded text-xs font-bold ${p.role === 'bloqueado' ? 'bg-red-50 text-red-700 border-red-300' : p.role === 'pendente' ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-800'}`}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="convidado">Convidado</option>
                        <option value="admin">Administrador</option>
                        <option value="bloqueado">Bloqueado</option>
                      </select>
                    </td>
                    <td className="p-4 text-center"><input type="checkbox" checked={p.can_import} onChange={() => handleTogglePerm(p.id, 'can_import', p.can_import)} className="w-4 h-4 accent-red-600" /></td>
                    <td className="p-4 text-center"><input type="checkbox" checked={p.can_share} onChange={() => handleTogglePerm(p.id, 'can_share', p.can_share)} className="w-4 h-4 accent-red-600" /></td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDeleteUser(p.id, p.email)} 
                        className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded text-xs font-bold transition shadow-sm inline-flex items-center gap-1"
                        title="Remover Usuário"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Remover</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="flex flex-col gap-3">
            {requests.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-800">{req.user_email} quer acessar a cifra:</p>
                  <p className="text-xs text-red-600 font-semibold mt-0.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>{req.songs?.title || 'Cifra Restrita'}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleResolveRequest(req.id, req.song_id, req.user_id, true)} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-green-700">Aprovar</button>
                  <button onClick={() => handleResolveRequest(req.id, req.song_id, req.user_id, false)} className="bg-red-600 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-red-700">Recusar</button>
                </div>
              </div>
            ))}
            {requests.length === 0 && <p className="text-center text-gray-400 py-8">Nenhuma solicitação de cadeado pendente.</p>}
          </div>
        )}

        {activeTab === 'grants' && (
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-gray-800 text-base">Acessos Individuais Liberados</h3>
            <p className="text-xs text-gray-500 -mt-2">Aqui você pode revogar o acesso de um usuário a uma cifra específica que possui cadeado.</p>
            {grants.map(grant => (
              <div key={grant.id} className="bg-white p-4 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-800">{grant.user_email}</p>
                  <p className="text-xs text-amber-700 font-semibold mt-0.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span>Acesso liberado à cifra: {grant.songs?.title || 'Cifra'}</span>
                  </p>
                </div>
                <button 
                  onClick={() => handleRevokeGrant(grant.id)} 
                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded font-bold transition shadow-sm"
                >
                  Bloquear Acesso
                </button>
              </div>
            ))}
            {grants.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum acesso individual liberado no momento.</p>}
          </div>
        )}

        {activeTab === 'invites' && (
          <form onSubmit={handleSendInvite} className="bg-white p-6 rounded-xl shadow-sm border flex flex-col gap-4 max-w-lg">
            <h3 className="font-bold text-gray-800 text-base">Convidado para Álbum</h3>
            <div>
              <label className="text-xs font-bold text-gray-700">E-mail do Usuário</label>
              <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="convidado@email.com" className="w-full border px-3 py-2 rounded text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Álbum</label>
              <select required value={selectedAlbumId} onChange={(e) => setSelectedAlbumId(e.target.value)} className="w-full border px-3 py-2 rounded text-sm mt-1 bg-white">
                <option value="">Selecione um álbum...</option>
                {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="canSave" checked={canSaveEdits} onChange={(e) => setCanSaveEdits(e.target.checked)} className="w-4 h-4 accent-red-600" />
              <label htmlFor="canSave" className="text-xs font-medium text-gray-700 cursor-pointer">Permitir que este usuário salve edições feitas na cifra</label>
            </div>
            <button type="submit" className="mt-2 bg-red-600 text-white py-2 rounded text-sm font-bold hover:bg-red-700 shadow">Enviar Convite</button>
          </form>
        )}
      </div>

      {/* Modal de Criação de Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-800 text-lg">Criar Novo Usuário</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700">E-mail</label>
                <input 
                  type="email" 
                  required 
                  value={newUserEmail} 
                  onChange={(e) => setNewUserEmail(e.target.value)} 
                  placeholder="usuario@email.com" 
                  className="w-full border px-3 py-2 rounded text-sm mt-1" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Senha Temporária</label>
                <input 
                  type="password" 
                  required 
                  minLength={6}
                  value={newUserPassword} 
                  onChange={(e) => setNewUserPassword(e.target.value)} 
                  placeholder="Mínimo de 6 caracteres" 
                  className="w-full border px-3 py-2 rounded text-sm mt-1" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">Cargo Inicial</label>
                <select 
                  value={newUserRole} 
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'convidado')} 
                  className="w-full border px-3 py-2 rounded text-sm mt-1 bg-white font-bold"
                >
                  <option value="convidado">Convidado</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded text-xs font-bold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={creatingUser}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold shadow disabled:opacity-50"
                >
                  {creatingUser ? 'Criando...' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}