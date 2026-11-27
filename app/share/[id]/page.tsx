import React from 'react'
import SharedSongClient from './SharedSongClient'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export const dynamicParams = true

export default function Page() {
  return <SharedSongClient />
}