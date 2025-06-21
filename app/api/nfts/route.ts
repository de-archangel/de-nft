import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/database"
import { tokenManager } from "@/lib/token-manager"
import { ObjectId } from "mongodb";


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const { db } = await connectToDatabase();

    // Initialize token manager
    await tokenManager.initialize();
    const reservedTokenId = await tokenManager.getNextTokenId();

    // Get form data
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const price = formData.get('price') as string;
    const collection = formData.get('collection') as string || 'Uncategorized';
    const royalties = formData.get('royalties') as string || '5';
    const type = formData.get('type') as string || 'image';
    const creator = formData.get('creator') as string;
    const isCollection = formData.get('isCollection') === 'true';

    // Process attributes
    const attributes: { trait_type: string; value: string }[] = [];
    const attrCount = parseInt(formData.get('attrCount') as string) || 0;
    for (let i = 0; i < attrCount; i++) {
      const trait_type = formData.get(`attributes[${i}][trait_type]`) as string;
      const value = formData.get(`attributes[${i}][value]`) as string;
      if (trait_type && value) {
        attributes.push({ trait_type, value });
      }
    }

    // Process files
    const assetUrls: string[] = [];
    const fileCount = parseInt(formData.get('fileCount') as string) || 0;
    for (let i = 0; i < fileCount; i++) {
      const url = formData.get(`files[${i}]`) as string;
      if (url) assetUrls.push(url);
    }

    const assetFile = formData.get('assetFile') as string | null;
    const previewImageUrl = formData.get('previewImageFile') as string | null;

    // Prepare NFT data
    const nftData = {
      name,
      description,
      type,
      price,
      collection,
      creator,
      owner: creator,
      reservedTokenId: reservedTokenId.toString(),
      attributes,
      royalties,
      blockchain: "0g",
      listed: true,
      verified: false,
      isLazyMinted: true,
      minted: false,
      isCollection,
      assets: {
        files: assetUrls.length > 0 ? assetUrls : assetFile ? [assetFile] : [],
        previewUrl: previewImageUrl || (assetUrls.length > 0 ? assetUrls[0] : assetFile),
        metadata: {
          name,
          description,
          image: previewImageUrl || (assetUrls.length > 0 ? assetUrls[0] : assetFile),
          attributes,
          collection
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert into MongoDB
    const result = await db.collection("nfts").insertOne(nftData);

    return NextResponse.json({
      success: true,
      nftId: result.insertedId.toString(),
      assetUrls: assetUrls.length > 0 ? assetUrls : assetFile ? [assetFile] : [],
      previewImageUrl,
      isCollection
    });

  } catch (error: any) {
    console.error("Error creating NFT:", error);
    return NextResponse.json({ 
      error: "Failed to create NFT",
      details: error.message 
    }, { status: 500 });
  }
}




export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const skip = Number.parseInt(searchParams.get("skip") || "0")
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1
    const owner = searchParams.get("owner")
    const creator = searchParams.get("creator")
    const collection = searchParams.get("collection")
    const type = searchParams.get("type")
    const isCollection = searchParams.get("isCollection")

    const { db } = await connectToDatabase()

    // Build filter
    const filter: any = {}
    if (owner) filter.owner = { $regex: new RegExp(owner, "i") }
    if (creator) filter.creator = { $regex: new RegExp(creator, "i") }
    if (collection) filter.collection = { $regex: new RegExp(collection, "i") }
    if (type) filter.type = type
    if (isCollection) filter.isCollection = isCollection === "true"

    // Get total count
    const total = await db.collection("nfts").countDocuments(filter)

    // Build sort object
    const sort: any = {}
    if (sortBy === "price") {
      sort.price = sortOrder
    } else {
      sort[sortBy] = sortOrder
    }

    // Get NFTs
    const nfts = await db.collection("nfts")
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray()

    // Transform MongoDB documents
    const transformedNFTs = nfts.map((nft) => ({
      id: nft._id.toString(),
      name: nft.name,
      description: nft.description,
      image: nft.assets?.previewUrl || nft.ipfs?.previewUrl,
      type: nft.type || "image",
      price: nft.price,
      usdPrice: nft.usdPrice || "0",
      collection: nft.collection,
      creator: nft.creator,
      owner: nft.owner,
      tokenId: nft.tokenId || nft.reservedTokenId || "0",
      contractAddress: nft.contractAddress || "",
      attributes: nft.attributes || [],
      rarity: nft.rarity,
      views: nft.views || 0,
      likes: nft.likes || 0,
      lastSale: nft.lastSale || nft.price,
      createdAt: nft.createdAt,
      updatedAt: nft.updatedAt,
      mintedAt: nft.mintedAt,
      blockchain: nft.blockchain || "0g",
      listed: nft.listed !== false,
      verified: nft.verified || false,
      model3d: nft.model3d,
      minted: nft.minted || false,
      mintTxHash: nft.mintTxHash,
      isCollection: nft.isCollection || false,
      assets: {
        files: nft.assets?.files || (nft.ipfs?.assets ? nft.ipfs.assets.map((a: any) => a.cid) : []),
        previewUrl: nft.assets?.previewUrl || nft.ipfs?.previewUrl,
        metadata: nft.assets?.metadata || nft.ipfs
      }
    }))

    return NextResponse.json({
      nfts: transformedNFTs,
      total,
      page: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Error fetching NFTs:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch NFTs",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}