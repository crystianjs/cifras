'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage('Erro ao entrar: ' + error.message)
    } else {
      router.push('/')
    }

    setLoading(false)
  }

  return (
    <main className="h-screen w-screen flex items-center justify-center bg-gray-100 font-sans p-4">
      <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 max-w-md w-full flex flex-col gap-4 items-center">
        
        {/* Ícone de Lápis estilizado seguindo o padrão da Favicon */}
        <div className="w-14 h-14 bg-[#2D68C4] rounded-full flex items-center justify-center shadow-md mb-[-4px]">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="#FACC15" stroke="#CA8A04" />
            <path d="m15 5 4 4" stroke="#475569" strokeWidth="1.5" />
            <path d="M4 20l2 2" stroke="#EF4444" strokeWidth="2.5" />
          </svg>
        </div>

        <div className="text-center w-full">
          <h1 className="text-2xl font-bold text-gray-900">Meu Cifras</h1>
          <p className="text-xs text-gray-500 mt-1">Acesse seu repertório pessoal</p>
        </div>

        {message && (
          <div className="w-full p-3 text-xs font-semibold bg-red-50 text-red-700 rounded border border-red-200 text-center">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold text-gray-700">E-mail</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="seu@email.com" 
              className="w-full border px-3 py-2 rounded text-sm mt-1 focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" 
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700">Senha</label>
            <input 
              type="password" 
              required 
              minLength={6}
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••" 
              className="w-full border px-3 py-2 rounded text-sm mt-1 focus:ring-1 focus:ring-[#2D68C4] focus:outline-none" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-2 bg-[#2D68C4] hover:bg-blue-700 text-white py-2.5 rounded text-sm font-bold shadow transition disabled:opacity-50 w-full"
          >
            {loading ? 'Carregando...' : 'Entrar'}
          </button>
        </form>

        <div className="text-center pt-3 border-t w-full">
          <p className="text-xs text-gray-500 font-medium">
            Não possui acesso? <span className="text-gray-700 font-bold">Entre em contato com um administrador (15) 9811-49404.</span>
          </p>
        </div>
      </div>
    </main>
  )
}