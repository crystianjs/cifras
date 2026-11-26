'use client'

import React, { useState, useEffect } from 'react'
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

interface Album {
  id: string
  name: string
}

export default function PermissoesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'invites'>('users')
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  
  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedAlbumId, setSelectedAlbumId] = useState('')
  const [canSaveEdits, setCanSaveEdits] = useState(false)
  const [loading, setLoading] = useState(true)

  // Estados para o Modal de Novo Usuário
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'convidado'>('convidado')
  const [creatingUser, setCreatingUser] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: myProf } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (myProf?.role !== 'admin') {
        alert('Acesso negado. Apenas administradores.')
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

    const { data: reqs } = await supabase
      .from('song_access_requests')
      .select('*, songs(title)')
      .eq('status', 'pendente')
    if (reqs) setRequests(reqs)

    const { data: albs } = await supabase.from('albums').select('id, name').order('name')
    if (albs) setAlbums(albs)

    setLoading(false)
  }

  const handleUpdateRole = async (id: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', id)
    loadData()
  }

  const handleTogglePerm = async (id: string, field: string, val: boolean) => {
    await supabase.from('profiles').update({ [field]: !val }).eq('id', id)
    loadData()
  }

  const handleResolveRequest = async (reqId: string, songId: string, userId: string, approve: boolean) => {
    if (approve) {
      await supabase.from('song_access_grants').insert([{ song_id: songId, user_id: userId }])
      await supabase.from('song_access_requests').update({ status: 'aprovado' }).eq('id', reqId)
    } else {
      await supabase.from('song_access_requests').update({ status: 'recusado' }).eq('id', reqId)
    }
    loadData()
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserEmail || !newUserPassword) {
      alert('Preencha o e-mail e a senha temporária.')
      return
    }

    setCreatingUser(true)
    const { data, error } = await supabase.auth.signUp({
      email: newUserEmail.trim(),
      password: newUserPassword,
      options: {
        data: { role: newUserRole }
      }
    })

    if (error) {
      alert('Erro ao criar usuário: ' + error.message)
    } else {
      if (data.user) {
        await supabase.from('profiles').update({ role: newUserRole }).eq('id', data.user.id)
      }
      alert(`Usuário ${newUserEmail} criado com sucesso como ${newUserRole}!`)
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
      alert('Preencha o e-mail e selecione o álbum.')
      return
    }

    const { error } = await supabase.from('album_invites').insert([
      { album_id: selectedAlbumId, guest_email: inviteEmail.trim(), can_save_edits: canSaveEdits }
    ])

    if (error) {
      alert('Erro ao enviar convite: ' + error.message)
    } else {
      alert(`Convite enviado com sucesso para ${inviteEmail}!`)
      setInviteEmail('')
      setSelectedAlbumId('')
      setCanSaveEdits(false)
    }
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center font-semibold text-gray-600">Carregando painel administrativo...</div>
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 flex flex-col font-sans">
      <header className="bg-[#2D68C4] text-white px-6 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded text-xs font-bold transition">
            ← Voltar para Cifras
          </button>
          <h1 className="text-xl font-bold">Painel do Administrador</h1>
        </div>
      </header>

      {/* Abas */}
      <div className="bg-white border-b border-gray-200 px-6 flex justify-between items-center flex-wrap gap-2">
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('users')} 
            className={`py-3 text-sm font-bold border-b-2 ${activeTab === 'users' ? 'border-[#2D68C4] text-[#2D68C4]' : 'border-transparent text-gray-500'}`}
          >
            Gerenciar Usuários ({profiles.length})
          </button>
          <button 
            onClick={() => setActiveTab('requests')} 
            className={`py-3 text-sm font-bold border-b-2 flex items-center gap-1.5 ${activeTab === 'requests' ? 'border-[#2D68C4] text-[#2D68C4]' : 'border-transparent text-gray-500'}`}
          >
            <span>Solicitações de Cadeado</span>
            {requests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{requests.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('invites')} 
            className={`py-3 text-sm font-bold border-b-2 ${activeTab === 'invites' ? 'border-[#2D68C4] text-[#2D68C4]' : 'border-transparent text-gray-500'}`}
          >
            Convidar para Álbuns
          </button>
        </div>

        {activeTab === 'users' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#2D68C4] hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded shadow transition flex items-center gap-1.5 my-2"
          >
            + Novo Usuário
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
                  <th className="p-4">Cargo / Status (Bloquear / Liberar)</th>
                  <th className="p-4 text-center">Importar</th>
                  <th className="p-4 text-center">Compartilhar</th>
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
                            Pediu Acesso!
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {/* Ao alterar para 'bloqueado' ou 'pendente', o usuário perde o acesso instantaneamente */}
                      <select 
                        value={p.role} 
                        onChange={(e) => handleUpdateRole(p.id, e.target.value)} 
                        className={`border px-2 py-1 rounded text-xs font-bold ${p.role === 'bloqueado' ? 'bg-red-50 text-red-700 border-red-300' : p.role === 'pendente' ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-800'}`}
                      >
                        <option value="pendente">Pendente (Aguardando)</option>
                        <option value="convidado">Convidado (Liberado)</option>
                        <option value="admin">Administrador</option>
                        <option value="bloqueado">Bloqueado (Sem acesso)</option>
                      </select>
                    </td>
                    <td className="p-4 text-center"><input type="checkbox" checked={p.can_import} onChange={() => handleTogglePerm(p.id, 'can_import', p.can_import)} className="w-4 h-4 accent-[#2D68C4]" /></td>
                    <td className="p-4 text-center"><input type="checkbox" checked={p.can_share} onChange={() => handleTogglePerm(p.id, 'can_share', p.can_share)} className="w-4 h-4 accent-[#2D68C4]" /></td>
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
                  <p className="text-xs text-[#2D68C4] font-semibold mt-0.5">🔒 {req.songs?.title || 'Cifra Restrita'}</p>
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

        {activeTab === 'invites' && (
          <form onSubmit={handleSendInvite} className="bg-white p-6 rounded-xl shadow-sm border flex flex-col gap-4 max-w-lg">
            <h3 className="font-bold text-gray-800 text-base">Convidar para Álbum</h3>
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
              <input type="checkbox" id="canSave" checked={canSaveEdits} onChange={(e) => setCanSaveEdits(e.target.checked)} className="w-4 h-4 accent-[#2D68C4]" />
              <label htmlFor="canSave" className="text-xs font-medium text-gray-700 cursor-pointer">Permitir que este usuário salve edições feitas na cifra</label>
            </div>
            <button type="submit" className="mt-2 bg-[#2D68C4] text-white py-2 rounded text-sm font-bold hover:bg-blue-700 shadow">Enviar Convite</button>
          </form>
        )}
      </div>

      {/* Modal de Criação de Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-800 text-lg">Criar Novo Usuário</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
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
                  className="bg-[#2D68C4] hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-bold shadow disabled:opacity-50"
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