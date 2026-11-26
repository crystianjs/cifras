'use client'

import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
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
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-[#2D68C4] text-white p-6 text-center">
          <h1 className="text-2xl font-bold tracking-wide">Meu Cifras</h1>
          <p className="text-xs text-blue-100 mt-1">
            {isSignUp ? 'Crie sua conta para gerenciar seu repertório' : 'Acesse seu repertório pessoal'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="p-6 flex flex-col gap-4">
          {message && (
            <div className="p-3 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              {message}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="border border-gray-300 px-3 py-2 rounded-md text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2D68C4]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="border border-gray-300 px-3 py-2 rounded-md text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2D68C4]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-[#2D68C4] hover:bg-blue-700 text-white font-bold py-2.5 rounded-md text-sm shadow transition disabled:opacity-50"
          >
            {loading ? 'Aguarde...' : isSignUp ? 'Criar Conta' : 'Entrar'}
          </button>

          <div className="text-center pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setMessage('')
              }}
              className="text-xs text-[#2D68C4] hover:underline font-semibold"
            >
              {isSignUp ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}