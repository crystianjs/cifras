'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) {
        setMessage('Erro ao cadastrar: ' + error.message)
      } else {
        setMessage('Conta criada! Verifique seu e-mail (se a confirmação estiver ativa) ou faça login.')
        setIsSignUp(false)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setMessage('Erro ao entrar: ' + error.message)
      } else {
        router.push('/')
      }
    }
    setLoading(false)
  }

  return (
    <main className="h-screen w-screen flex items-center justify-center bg-gray-100 font-sans p-4">
      <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 max-w-md w-full flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900 text-center">Meu Cifras</h1>
        <p className="text-xs text-gray-500 text-center -mt-2">Acesse seu repertório pessoal</p>

        {message && (
          <div className="p-3 text-xs font-semibold bg-blue-50 text-blue-700 rounded border border-blue-200">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-3">
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
            className="mt-2 bg-[#2D68C4] hover:bg-blue-700 text-white py-2.5 rounded text-sm font-bold shadow transition disabled:opacity-50"
          >
            {loading ? 'Carregando...' : (isSignUp ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>

        <div className="text-center pt-2 border-t">
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-xs text-[#2D68C4] font-bold hover:underline"
          >
            {isSignUp ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </main>
  )
}