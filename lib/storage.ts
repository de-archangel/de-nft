'use client'

import { type EdgeStoreRouter } from '@/lib/edgestore'
import { createEdgeStoreProvider } from '@edgestore/react'

const { EdgeStoreProvider, useEdgeStore } = createEdgeStoreProvider<EdgeStoreRouter>()

export { EdgeStoreProvider, useEdgeStore }

export interface StoredFile {
  url: string
  size: number
  uploadedAt: Date
  metadata: {
    type: string
    originalName: string
  }
}

export async function uploadFile(file: File): Promise<StoredFile> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`)
  }

  return await response.json()
}

export async function uploadFiles(files: File[]): Promise<StoredFile[]> {
  return Promise.all(files.map(file => uploadFile(file)))
}

export async function deleteFile(url: string): Promise<void> {
  await fetch('/api/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  })
}