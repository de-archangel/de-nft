import { initEdgeStore } from '@edgestore/server'
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app'

const es = initEdgeStore.create()

const edgeStoreRouter = es.router({
  Ognfts: es.fileBucket({
    maxSize: 1024 * 1024 * 50, // 50MB
    accept: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'model/gltf-binary',
      'application/octet-stream'
    ]
  })
  .beforeDelete(() => true) // allow delete
})

export const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
})

export type EdgeStoreRouter = typeof edgeStoreRouter