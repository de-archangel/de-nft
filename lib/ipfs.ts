import { create } from 'ipfs-http-client'
import { Buffer } from 'buffer'

// Validate environment variables
if (!process.env.INFURA_IPFS_PROJECT_ID || !process.env.INFURA_IPFS_PROJECT_SECRET) {
  throw new Error(
    'Missing Infura IPFS credentials. Please set INFURA_IPFS_PROJECT_ID and INFURA_IPFS_PROJECT_SECRET in your environment variables.'
  )
}
console.log(  process.env.INFURA_IPFS_PROJECT_ID + ':' + process.env.INFURA_IPFS_PROJECT_SECRET
)
// Configure IPFS client with proper authentication
const auth = 'Basic ' + Buffer.from(
  process.env.INFURA_IPFS_PROJECT_ID + ':' + process.env.INFURA_IPFS_PROJECT_SECRET
).toString('base64')

const ipfs = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
    authorization: auth
  },
  timeout: 30000 // 30 seconds timeout
})

export interface IPFSFile {
  cid: string
  originalName: string
  type: string
}

export async function uploadToIPFS(data: File | Blob | Buffer | string): Promise<string> {
  try {
    let content: Buffer
    if (data instanceof File || data instanceof Blob) {
      content = Buffer.from(await data.arrayBuffer())
    } else if (typeof data === 'string') {
      // Handle base64 strings or regular strings
      if (data.startsWith('data:')) {
        const base64Data = data.split(',')[1]
        content = Buffer.from(base64Data, 'base64')
      } else {
        content = Buffer.from(data, 'utf-8')
      }
    } else {
      content = data
    }

    const added = await ipfs.add(content)
    return `ipfs://${added.cid.toString()}`
  } catch (error) {
    console.error('Error uploading to IPFS:', error)
    throw new Error(`IPFS upload failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function uploadJSONToIPFS(json: object): Promise<string> {
  try {
    const content = JSON.stringify(json)
    return await uploadToIPFS(content)
  } catch (error) {
    console.error('Error uploading JSON to IPFS:', error)
    throw new Error(`JSON upload to IPFS failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function uploadMultipleToIPFS(files: File[]): Promise<IPFSFile[]> {
  try {
    const results: IPFSFile[] = []
    
    for (const file of files) {
      const cid = await uploadToIPFS(file)
      results.push({
        cid,
        originalName: file.name,
        type: file.type
      })
    }
    
    return results
  } catch (error) {
    console.error('Error uploading multiple files:', error)
    throw new Error(`Multiple file upload failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}