import { type NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { connectToDatabase } from "@/lib/database"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()
    let nft = null

    // Try all possible ID fields
    const queryConditions = [
      { _id: new ObjectId(params.id) },
      { id: params.id },
      { tokenId: params.id }
    ].filter(cond => !('_id' in cond) || ObjectId.isValid(params.id))

    for (const condition of queryConditions) {
      nft = await db.collection("nfts").findOne(condition)
      if (nft) break
    }

    if (!nft) {
      return NextResponse.json(
        { error: "NFT not found" }, 
        { status: 404 }
      )
    }

    // Transform the response
    const response = {
      id: nft._id?.toString() || nft.id,
      name: nft.name,
      description: nft.description,
      image: nft.assets?.previewUrl || nft.ipfs?.previewUrl,
      type: nft.type || "image",
      price: nft.price,
      collection: nft.collection,
      creator: nft.creator,
      owner: nft.owner,
      tokenId: nft.tokenId || nft.reservedTokenId,
      attributes: nft.attributes || [],
      createdAt: nft.createdAt,
      updatedAt: nft.updatedAt,
      assets: {
        files: nft.assets?.files || (nft.ipfs?.assets ? nft.ipfs.assets.map((a: any) => a.cid) : []),
        previewUrl: nft.assets?.previewUrl || nft.ipfs?.previewUrl,
        metadata: nft.assets?.metadata || nft.ipfs
      }
    }

    return NextResponse.json({ nft: response })
  } catch (error) {
    console.error("Error fetching NFT:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch NFT",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const updates = await request.json()
    const { db } = await connectToDatabase()

    // Validate updates
    if (updates.assets || updates.ipfs) {
      return NextResponse.json(
        { error: "Cannot directly update asset storage references" },
        { status: 400 }
      )
    }

    const updatePayload = {
      ...updates,
      updatedAt: new Date()
    }

    let result = null
    const queryConditions = [
      { _id: new ObjectId(params.id) },
      { id: params.id }
    ].filter(cond => !('_id' in cond) || ObjectId.isValid(params.id))

    for (const condition of queryConditions) {
      result = await db.collection("nfts")
        .updateOne(condition, { $set: updatePayload })
      if (result.matchedCount > 0) break
    }

    if (!result || result.matchedCount === 0) {
      return NextResponse.json(
        { error: "NFT not found" }, 
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: "NFT updated successfully",
      updatedFields: Object.keys(updates)
    })
  } catch (error) {
    console.error("Error updating NFT:", error)
    return NextResponse.json(
      { 
        error: "Failed to update NFT",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()

    // First find the NFT to get asset URLs
    let nft = null
    const queryConditions = [
      { _id: new ObjectId(params.id) },
      { id: params.id }
    ].filter(cond => !('_id' in cond) || ObjectId.isValid(params.id))

    for (const condition of queryConditions) {
      nft = await db.collection("nfts").findOne(condition)
      if (nft) break
    }

    if (!nft) {
      return NextResponse.json(
        { error: "NFT not found" }, 
        { status: 404 }
      )
    }

    // Delete the NFT record
    let result = null
    for (const condition of queryConditions) {
      result = await db.collection("nfts").deleteOne(condition)
      if (result.deletedCount > 0) break
    }

    if (!result || result.deletedCount === 0) {
      return NextResponse.json(
        { error: "NFT not found" }, 
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: "NFT deleted successfully" 
    })
  } catch (error) {
    console.error("Error deleting NFT:", error)
    return NextResponse.json(
      { 
        error: "Failed to delete NFT",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}