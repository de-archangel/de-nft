import { Schema, model } from 'mongoose'

interface IPFSFile {
  cid: string
  originalName: string
  type: string
}

interface NFTAttributes {
  trait_type: string
  value: string
}

interface IPFSData {
  assets: IPFSFile[]
  previewUrl: string
  metadataUrl: string
  collectionMetadataUrl?: string
}

const NFTSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['image', 'video', 'audio', '3d'], required: true },
  price: { type: String, required: true },
  collection: { type: String, default: 'Uncategorized' },
  creator: { type: String, required: true },
  owner: { type: String, required: true },
  reservedTokenId: { type: String },
  attributes: [{
    trait_type: String,
    value: String
  }],
  royalties: { type: String, default: '5' },
  blockchain: { type: String, default: '0g' },
  listed: { type: Boolean, default: true },
  verified: { type: Boolean, default: false },
  isLazyMinted: { type: Boolean, default: true },
  minted: { type: Boolean, default: false },
  isCollection: { type: Boolean, default: false },
  ipfs: {
    assets: [{
      cid: String,
      originalName: String,
      type: String
    }],
    previewUrl: String,
    metadataUrl: String,
    collectionMetadataUrl: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Indexes for better query performance
NFTSchema.index({ name: 'text', description: 'text' })
NFTSchema.index({ creator: 1 })
NFTSchema.index({ owner: 1 })
NFTSchema.index({ collection: 1 })
NFTSchema.index({ type: 1 })
NFTSchema.index({ price: 1 })
NFTSchema.index({ createdAt: -1 })
NFTSchema.index({ isCollection: 1 })

export const NFT = model('NFT', NFTSchema)