"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useEdgeStore } from '@/lib/storage'
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  X,
  Plus,
  ImageIcon,
  CuboidIcon as Cube,
  Video,
  Music,
  Sparkles,
  Zap,
  Star,
} from "lucide-react";
import Header from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/components/wallet-provider";

import dynamic from "next/dynamic";
import { resolveURL } from "@/lib/utils";
const ModelViewer = dynamic(() => import("./model-viewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/20 rounded-2xl">
      <p className="text-white/60">Loading 3D viewer...</p>
    </div>
  ),
});

interface Attribute {
  trait_type: string;
  value: string;
}

const SUPPORTED_EXTENSIONS = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
  video: [".mp4", ".webm", ".mov"],
  audio: [".mp3", ".wav", ".ogg"],
  "3d": [".glb", ".gltf", ".obj", ".stl", ".fbx", ".dae", ".ply"],
};

const SUPPORTED_MIME_TYPES = {
  image: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/jpg",
  ],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
  "3d": [
    "model/gltf-binary", // GLB
    "model/gltf+json", // GLTF
    "application/octet-stream", // Generic binary
    "application/x-tgif", // OBJ
    "application/sla", // STL
    "model/obj", // OBJ alternative
    "model/stl", // STL alternative
    "model/x-wavefront-obj", // OBJ
    "application/vnd.ms-pki.stl", // STL alternative
  ],
};

export default function CreatePage() {
  const { isConnected, address } = useWallet();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    collection: "",
    royalties: "5",
    type: "image" as "image" | "3d" | "video" | "audio",
  });
  const [attributes, setAttributes] = useState<Attribute[]>([
    { trait_type: "Type", value: "INFT (Intelligent NFT)" },
    { "trait_type": "Intelligence Level	", "value": "Oracle-Based" },


  ]);  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintingStep, setMintingStep] = useState("");
  const [isCollection, setIsCollection] = useState(false);
  const [collectionFiles, setCollectionFiles] = useState<File[]>([]);
  const [collectionPreviews, setCollectionPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const collectionInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { edgestore } = useEdgeStore()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCollectionUpload = (files: FileList) => {
    const validFiles = Array.from(files).filter((file) => {
      const extension = "." + file.name.toLowerCase().split(".").pop();
      return SUPPORTED_EXTENSIONS[formData.type].includes(extension || "");
    });

    if (validFiles.length === 0) {
      toast({
        title: "❌ No Valid Files",
        description: `No files with supported extensions (${SUPPORTED_EXTENSIONS[
          formData.type
        ].join(", ")}) were found.`,
        variant: "destructive",
      });
      return;
    }

    setCollectionFiles(validFiles);

    // Create previews for the first few files
    const previews: string[] = [];
    const filesToPreview = Math.min(validFiles.length, 5);

    for (let i = 0; i < filesToPreview; i++) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previews[i] = e.target?.result as string;
        setCollectionPreviews([...previews]);
      };
      reader.readAsDataURL(validFiles[i]);
    }
  };

  const handleMint = async () => {
    if (!isConnected) {
      toast({
        title: "❌ Wallet Not Connected",
        description: "Please connect your wallet to create NFTs.",
        variant: "destructive",
      });
      return;
    }
  
    if (!formData.name.trim()) {
      toast({
        title: "❌ Missing Name",
        description: "Please enter a name for your NFT.",
        variant: "destructive",
      });
      return;
    }
  
    if (!formData.description.trim()) {
      toast({
        title: "❌ Missing Description",
        description: "Please enter a description for your NFT.",
        variant: "destructive",
      });
      return;
    }
  
    if (!formData.price || Number.parseFloat(formData.price) <= 0) {
      toast({
        title: "❌ Invalid Price",
        description: "Please enter a valid price greater than 0.",
        variant: "destructive",
      });
      return;
    }
  
    if ((!isCollection && !fileObject) || (isCollection && collectionFiles.length === 0)) {
      toast({
        title: "❌ Missing Asset",
        description: "Please upload an asset for your NFT.",
        variant: "destructive",
      });
      return;
    }
  
    setIsMinting(true);
    setMintingStep("Preparing files...");
  
    // Track uploaded files for cleanup
    const uploadedFiles: { url: string; file: File }[] = [];
    let previewImageUrl: string | null = null;
  
    try {
      const formDataObj = new FormData();
  
      // Append text fields
      formDataObj.append('name', formData.name);
      formDataObj.append('description', formData.description);
      formDataObj.append('price', formData.price);
      formDataObj.append('collection', formData.collection);
      formDataObj.append('royalties', formData.royalties);
      formDataObj.append('type', formData.type);
      formDataObj.append('creator', address!);
      formDataObj.append('isCollection', String(isCollection));
  
      // Append attributes
      attributes.forEach((attr, index) => {
        formDataObj.append(`attributes[${index}][trait_type]`, attr.trait_type);
        formDataObj.append(`attributes[${index}][value]`, attr.value);
      });
      formDataObj.append('attrCount', String(attributes.length));
  
      // Upload files
      setMintingStep("Uploading assets...");
      
      if (isCollection) {
        // Upload collection files
        const uploadPromises = collectionFiles.map(file => 
          edgestore.Ognfts.upload({ 
            file,
            options: {
              manualFileName: file.name,
              replaceTargetUrl: collectionPreviews.find(p => p.includes(file.name))
            }
          }).then(res => {
            uploadedFiles.push({ url: res.url, file });
            return res;
          })
        );
        
        const results = await Promise.all(uploadPromises);
        results.forEach((res, index) => {
          formDataObj.append(`files[${index}]`, res.url);
        });
        formDataObj.append('fileCount', String(results.length));
  
        // Upload preview image
        if (imageFile) {
          const previewRes = await edgestore.Ognfts.upload({ 
            file: imageFile,
            options: { manualFileName: 'preview-' + imageFile.name }
          });
          previewImageUrl = previewRes.url;
          formDataObj.append('previewImageFile', previewImageUrl);
        }
      } else {
        // Upload single asset
        if (fileObject) {
          const assetRes = await edgestore.Ognfts.upload({ 
            file: fileObject,
            options: { manualFileName: fileObject.name }
          });
          uploadedFiles.push({ url: assetRes.url, file: fileObject });
          formDataObj.append('assetFile', assetRes.url);
        }
        
        // Upload preview image
        if (imageFile) {
          const previewRes = await edgestore.Ognfts.upload({ 
            file: imageFile,
            options: { manualFileName: 'preview-' + imageFile.name }
          });
          previewImageUrl = previewRes.url;
          formDataObj.append('previewImageFile', previewImageUrl);
        }
      }
  
      // Create NFT record
      setMintingStep("Creating NFT...");
      
      const response = await fetch(resolveURL("/api/nfts"), {
        method: "POST",
        body: formDataObj,
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create NFT");
      }
  
      const result = await response.json();
  
      toast({
        title: "🎉 NFT Created Successfully!",
        description: `${formData.name} has been created!`,
      });
  
      // Reset form
      setFormData({
        name: "",
        description: "",
        price: "",
        collection: "",
        royalties: "5",
        type: "image",
      });
      setAttributes([]);
      setFilePreview(null);
      setFileObject(null);
      setImagePreview(null);
      setImageFile(null);
      setCollectionFiles([]);
      setCollectionPreviews([]);
      setIsCollection(false);
  
      // Redirect to NFT page
      setTimeout(() => {
        window.location.href = `/nft/${result.nftId}`;
      }, 2000);
  
    } catch (error: any) {
      console.error("Creation error:", error);
      
      // Cleanup uploaded files on error
      try {
        const filesToDelete = [...uploadedFiles.map(f => f.url)];
        if (previewImageUrl) filesToDelete.push(previewImageUrl);
        
        await Promise.all(
          filesToDelete.map(url => 
            edgestore.Ognfts.delete({ url })
              .catch(e => console.error("Failed to delete file:", e))
        ));
      } catch (cleanupError) {
        console.error("Error during cleanup:", cleanupError);
      }
  
      toast({
        title: "❌ Creation Failed",
        description: error.message || "There was an error creating your NFT. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMinting(false);
      setMintingStep("");
    }
  };
  

  const getAcceptString = () => {
    return SUPPORTED_EXTENSIONS[formData.type].join(",");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "3d":
        return <Cube className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "audio":
        return <Music className="w-4 h-4" />;
      default:
        return <ImageIcon className="w-4 h-4" />;
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;

    // Determine file type
    let detectedType: "image" | "3d" | "video" | "audio" = "image";

    // Check by MIME type first
    if (SUPPORTED_MIME_TYPES.image.includes(file.type)) {
      detectedType = "image";
    } else if (SUPPORTED_MIME_TYPES.video.includes(file.type)) {
      detectedType = "video";
    } else if (SUPPORTED_MIME_TYPES.audio.includes(file.type)) {
      detectedType = "audio";
    } else if (SUPPORTED_MIME_TYPES["3d"].includes(file.type)) {
      detectedType = "3d";
    }
    // Fallback to check by file extension
    else {
      const extension = "." + file.name.toLowerCase().split(".").pop();
      if (SUPPORTED_EXTENSIONS["3d"].includes(extension || "")) {
        detectedType = "3d";
      } else if (SUPPORTED_EXTENSIONS.image.includes(extension || "")) {
        detectedType = "image";
      } else if (SUPPORTED_EXTENSIONS.video.includes(extension || "")) {
        detectedType = "video";
      } else if (SUPPORTED_EXTENSIONS.audio.includes(extension || "")) {
        detectedType = "audio";
      } else {
        toast({
          title: "❌ Unsupported File Type",
          description: `Please upload a supported ${
            formData.type
          } file (${SUPPORTED_EXTENSIONS[formData.type].join(", ")})`,
          variant: "destructive",
        });
        return;
      }
    }

    // Validate file size (50MB max for 3D models, 10MB for others)
    const maxSize = detectedType === "3d" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "❌ File Too Large",
        description: `Please upload a file smaller than ${
          detectedType === "3d" ? "50MB" : "10MB"
        }.`,
        variant: "destructive",
      });
      return;
    }

    // Update state
    setFormData((prev) => ({ ...prev, type: detectedType }));
    setFileObject(file);
    console.log(file)
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string;
      setFilePreview(previewUrl);

      // If this is an image, also set it as the preview image
      if (detectedType === "image") {
        setImagePreview(previewUrl);
        setImageFile(file);
      }
    };

    if (detectedType === "image" || detectedType === "3d") {
      reader.readAsDataURL(file);
    } else {
      // For video/audio, create object URL
      const objectUrl = URL.createObjectURL(file);
      setFilePreview(objectUrl);

      // For non-image assets, we still need a preview image
      if (!imagePreview) {
        setImagePreview("/default-preview.jpg");
      }
    }

    toast({
      title: "✅ File Uploaded",
      description: `Successfully uploaded ${file.name} as ${detectedType}`,
    });
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleCollectionInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files) {
      handleCollectionUpload(event.target.files);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      isCollection
        ? handleCollectionUpload(event.dataTransfer.files)
        : handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const triggerFileInput = () => {
    isCollection
      ? collectionInputRef.current?.click()
      : fileInputRef.current?.click();
  };

  const addAttribute = () => {
    setAttributes((prev) => [...prev, { trait_type: "", value: "" }]);
  };

  const updateAttribute = (
    index: number,
    field: keyof Attribute,
    value: string
  ) => {
    setAttributes((prev) =>
      prev.map((attr, i) => (i === index ? { ...attr, [field]: value } : attr))
    );
  };

  const removeAttribute = (index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    return () => {
      if (filePreview && formData.type !== "image") {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview, formData.type]);

  const renderFilePreview = () => {
    if (!filePreview) return null;

    switch (formData.type) {
      case "image":
        return (
          <Image
            src={filePreview}
            alt="Preview"
            width={400}
            height={400}
            className="mx-auto rounded-2xl object-cover shadow-2xl"
          />
        );
      case "3d":
        return (
          <div className="w-full h-96 bg-black/20 rounded-2xl overflow-hidden">
            <ModelViewer
              src={filePreview}
              fileType={fileObject?.name.split(".").pop()?.toLowerCase()}
            />
          </div>
        );
      case "video":
        return (
          <video
            src={filePreview}
            controls
            className="w-full h-auto max-h-96 mx-auto rounded-2xl shadow-2xl"
          />
        );
      case "audio":
        return (
          <div className="w-full p-8 bg-black/20 rounded-2xl flex items-center justify-center">
            <audio src={filePreview} controls className="w-full" />
          </div>
        );
      default:
        return null;
    }
  };

  const renderCollectionPreview = () => {
    if (collectionFiles.length === 0) return null;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {collectionPreviews.map((preview, index) => (
            <div
              key={index}
              className="relative w-16 h-16 rounded-lg overflow-hidden"
            >
              {formData.type === "image" ? (
                <Image
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-black/20 flex items-center justify-center">
                  {getTypeIcon(formData.type)}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                {collectionFiles[index].name}
              </div>
            </div>
          ))}
          {collectionFiles.length > 5 && (
            <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
              +{collectionFiles.length - 5}
            </div>
          )}
        </div>
        <p className="text-white/80 text-center">
          {collectionFiles.length} files selected
        </p>
      </div>
    );
  };

  const renderUploadArea = () => {
    if (isCollection) {
      return (
        <div
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ${
            isDragOver
              ? "border-purple-400 bg-purple-400/10"
              : "border-white/20 hover:border-white/40"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={triggerFileInput}
        >
          <input
            ref={collectionInputRef}
            type="file"
            multiple
            accept={getAcceptString()}
            onChange={handleCollectionInputChange}
            className="hidden"
          />

          {collectionFiles.length === 0 ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                <Upload className="w-10 h-10 text-white/60" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">
                Drop your files here
              </h3>
              <p className="text-white/60 mb-4">
                Upload multiple files to create a collection
              </p>
              <p className="text-white/40 text-sm">
                Supports: {SUPPORTED_EXTENSIONS[formData.type].join(", ")}
              </p>
            </>
          ) : (
            renderCollectionPreview()
          )}
        </div>
      );
    } else {
      return (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer group ${
            isDragOver
              ? "border-purple-400 bg-purple-400/10 scale-105"
              : "border-white/20 hover:border-white/40 hover:bg-white/5"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={triggerFileInput}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptString()}
            onChange={handleFileInputChange}
            className="hidden"
          />

          {filePreview ? (
            <div className="relative animate-fade-in group">
              {renderFilePreview()}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-4 right-4 w-12 h-12 rounded-2xl transform hover:scale-110 transition-all shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilePreview(null);
                  setFileObject(null);
                }}
              >
                <X className="w-5 h-5" />
              </Button>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Button
                  variant="secondary"
                  className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileInput();
                  }}
                >
                  Change File
                </Button>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-12 h-12 text-white/60" />
              </div>
              <h3 className="text-white text-xl font-semibold mb-4">
                Drop your file here
              </h3>
              <p className="text-white/60 mb-6 text-lg">
                Drag and drop your masterpiece, or click to browse
              </p>
              <p className="text-white/40 text-sm mb-6">
                Supports: JPG, PNG, GIF, SVG, MP4, WEBM, MP3, WAV, OGG, GLB,
                GLTF (Max 50MB for 3D models)
              </p>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white/20 text-white hover:bg-white/10 hover:text-white backdrop-blur-xl px-8 py-4 rounded-2xl transform hover:scale-105 transition-all upload-button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFileInput();
                }}
              >
                <Upload className="w-5 h-5 mr-2" />
                Choose File
              </Button>
            </div>
          )}
        </div>
      );
    }
  };

  const renderLivePreview = () => {
    if (!filePreview && collectionFiles.length === 0) return null;

    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all duration-500 rounded-3xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-white text-2xl font-bold">
            Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-white/5 rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="relative aspect-square rounded-2xl overflow-hidden mb-6 group">
              {isCollection ? (
                <div className="w-full h-full flex items-center justify-center bg-black/20">
                  <div className="text-center">
                    <div className="mx-auto mb-4 w-20 h-20 bg-white/10 rounded-full flex items-center justify-center">
                      <Cube className="w-10 h-10 text-white/60" />
                    </div>
                    <h3 className="text-white text-xl font-semibold">
                      {formData.name || "Untitled Collection"}
                    </h3>
                    <p className="text-white/60">
                      {collectionFiles.length} items
                    </p>
                  </div>
                </div>
              ) : (
                renderFilePreview()
              )}
              <div className="absolute top-4 left-4 flex gap-2">
                <Badge
                  variant="secondary"
                  className="bg-purple-500/20 text-purple-400 backdrop-blur-sm px-3 py-1 rounded-full"
                >
                  {getTypeIcon(formData.type)}
                  <span className="ml-2 capitalize">{formData.type}</span>
                </Badge>
                {isCollection && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-500/20 text-blue-400 backdrop-blur-sm px-3 py-1 rounded-full"
                  >
                    Collection
                  </Badge>
                )}
              </div>
            </div>
            <h3 className="text-white font-bold text-2xl mb-2">
              {formData.name || "Untitled NFT"}
            </h3>
            <p className="text-white/60 text-lg mb-4">
              {formData.collection || "No Collection"}
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/40 text-sm mb-1">Price</p>
                <p className="text-white font-bold text-xl">
                  {formData.price ? `${formData.price} OG` : "No Price Set"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-sm mb-1">Royalties</p>
                <p className="text-white/60 text-lg">{formData.royalties}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="relative z-10">
        <Header />

        <div className="container mx-auto px-6 py-12">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="text-center mb-16 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-6 py-2 mb-8">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-white/80 text-sm">
                  Create Your Masterpiece
                </span>
              </div>

              <h1 className="text-5xl md:text-7xl font-black text-white mb-6">
                <span className="block">Mint Your</span>
                <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                  Digital Asset
                </span>
              </h1>
              <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
                Transform your creativity into valuable NFTs on the 0G
                blockchain. Real on-chain minting with wallet transactions.
              </p>
            </div>

            {/* Connection Warning */}
            {!isConnected && (
              <div className="mb-8 animate-fade-in-up delay-200">
                <Card className="bg-yellow-500/10 border-yellow-500/20 backdrop-blur-xl rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center">
                        <Zap className="w-6 h-6 text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-xl mb-1">
                          Connect Your Wallet
                        </h3>
                        <p className="text-white/70">
                          You need to connect your wallet to mint NFTs on the 0G
                          blockchain.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Upload Section */}
              <div className="space-y-8 animate-fade-in-left">
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all duration-500 rounded-3xl overflow-hidden">
                  <CardHeader className="pb-6">
                    <CardTitle className="text-white text-2xl font-bold flex items-center gap-3">
                      <Upload className="w-6 h-6 text-purple-400" />
                      Upload Your Creation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Collection Toggle */}
                    <Label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isCollection}
                        onChange={(e) => setIsCollection(e.target.checked)}
                        className="w-5 h-5 rounded bg-white/10 border-white/20 focus:ring-purple-500"
                      />
                      <span className="text-white">This is a collection</span>
                    </Label>

                    {/* Upload Area */}
                    {renderUploadArea()}

                    {/* Asset Type Selector */}
                    <div>
                      <Label className="text-white mb-3 block text-lg font-semibold">
                        Asset Type
                      </Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value) =>
                          handleInputChange("type", value)
                        }
                      >
                        <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/15 transition-colors rounded-2xl py-6 text-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 border-white/20 backdrop-blur-2xl rounded-2xl">
                          <SelectItem
                            value="image"
                            className="text-white hover:bg-white/10 focus:bg-white/10 rounded-xl p-4"
                          >
                            <div className="flex items-center gap-3">
                              <ImageIcon className="w-5 h-5" />
                              <span className="text-lg">Image</span>
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="3d"
                            className="text-white hover:bg-white/10 focus:bg-white/10 rounded-xl p-4"
                          >
                            <div className="flex items-center gap-3">
                              <Cube className="w-5 h-5" />
                              <span className="text-lg">3D Model</span>
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="video"
                            className="text-white hover:bg-white/10 focus:bg-white/10 rounded-xl p-4"
                          >
                            <div className="flex items-center gap-3">
                              <Video className="w-5 h-5" />
                              <span className="text-lg">Video</span>
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="audio"
                            className="text-white hover:bg-white/10 focus:bg-white/10 rounded-xl p-4"
                          >
                            <div className="flex items-center gap-3">
                              <Music className="w-5 h-5" />
                              <span className="text-lg">Audio</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Preview Image Upload (for non-image assets) */}
                    {(formData.type !== "image" || isCollection) && (
                      <div>
                        <Label className="text-white mb-3 block text-lg font-semibold">
                          {isCollection
                            ? "Collection Cover Image"
                            : "Preview Image"}
                        </Label>
                        <div
                          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 cursor-pointer ${
                            !imagePreview &&
                            "hover:bg-white/5 hover:border-white/40"
                          }`}
                          onClick={() =>
                            document.getElementById("preview-upload")?.click()
                          }
                        >
                          <input
                            id="preview-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                  setImagePreview(e.target?.result as string);
                                  setImageFile(file);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                          {imagePreview ? (
                            <div className="relative">
                              <Image
                                src={imagePreview}
                                alt="Preview"
                                width={300}
                                height={300}
                                className="mx-auto rounded-xl object-cover"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 bg-black/70 hover:bg-black/90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImagePreview(null);
                                  setImageFile(null);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-white/60" />
                              </div>
                              <p className="text-white/60">
                                Click to upload a preview image
                              </p>
                              <p className="text-white/40 text-sm mt-2">
                                Recommended: 1000x1000px, JPG/PNG
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Preview Card */}
                {renderLivePreview()}
              </div>

              {/* Form Section */}
              <div className="space-y-8 animate-fade-in-right">
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all duration-500 rounded-3xl overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-white text-2xl font-bold">
                      NFT Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="text-white mb-3 block text-lg font-semibold">
                        Name *
                      </Label>
                      <Input
                        placeholder="Enter your NFT name"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-purple-500 transition-all hover:bg-white/15 rounded-2xl py-6 text-lg"
                      />
                    </div>

                    <div>
                      <Label className="text-white mb-3 block text-lg font-semibold">
                        Description *
                      </Label>
                      <Textarea
                        placeholder="Tell the world about your creation..."
                        value={formData.description}
                        onChange={(e) =>
                          handleInputChange("description", e.target.value)
                        }
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[120px] focus:ring-2 focus:ring-purple-500 transition-all hover:bg-white/15 rounded-2xl text-lg resize-none"
                      />
                    </div>

                    <div>
                      <Label className="text-white mb-3 block text-lg font-semibold">
                        Collection
                      </Label>
                      <Select
                        value={formData.collection}
                        onValueChange={(value) =>
                          handleInputChange("collection", value)
                        }
                      >
                        <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/15 transition-colors rounded-2xl py-6 text-lg">
                          <SelectValue placeholder="Select or create collection" />
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 border-white/20 backdrop-blur-2xl rounded-2xl">
                          <SelectItem
                            value="0G Cosmic Collection"
                            className="text-white hover:bg-white/10 focus:bg-white/10 rounded-xl p-4"
                          >
                            0G Cosmic Collection
                          </SelectItem>
                          <SelectItem
                            value="AI Artifacts"
                            className="text-white hover:bg-white/10 focus:bg-white/10 rounded-xl p-4"
                          >
                            AI Artifacts
                          </SelectItem>
                          <SelectItem
                            value="Quantum Cats"
                            className="text-white hover:bg-white/10 focus:bg-white/10 rounded-xl p-4"
                          >
                            Quantum Cats
                          </SelectItem>
                          <SelectItem
                            value="create-new"
                            className="text-white hover:bg-white/10 focus:bg-white/10 rounded-xl p-4"
                          >
                            + Create New Collection
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <Label className="text-white mb-3 block text-lg font-semibold">
                          Price (OG) *
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.price}
                          onChange={(e) =>
                            handleInputChange("price", e.target.value)
                          }
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-purple-500 transition-all hover:bg-white/15 rounded-2xl py-6 text-lg"
                        />
                      </div>
                      <div>
                        <Label className="text-white mb-3 block text-lg font-semibold">
                          Royalties (%)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          value={formData.royalties}
                          onChange={(e) =>
                            handleInputChange("royalties", e.target.value)
                          }
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-purple-500 transition-all hover:bg-white/15 rounded-2xl py-6 text-lg"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Attributes */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all duration-500 rounded-3xl overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-2xl font-bold">
                        Attributes
                      </CardTitle>
                      <Button
                        variant="outline"
                        onClick={addAttribute}
                        className="border-2 border-white/20 text-white hover:bg-white/10 hover:text-white transform hover:scale-105 transition-all rounded-2xl px-6 py-3"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Add Trait
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {attributes.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                          <Star className="w-8 h-8 text-white/40" />
                        </div>
                        <p className="text-white/60 text-lg">
                          No attributes added yet
                        </p>
                        <p className="text-white/40">
                          Click "Add Trait" to make your NFT unique
                        </p>
                      </div>
                    ) : (
                      attributes.map((attr, index) => (
                        <div key={index} className="flex gap-4 animate-fade-in">
                          <Input
                            placeholder="Trait type (e.g., Color)"
                            value={attr.trait_type}
                            onChange={(e) =>
                              updateAttribute(
                                index,
                                "trait_type",
                                e.target.value
                              )
                            }
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-purple-500 transition-all hover:bg-white/15 rounded-2xl py-4"
                          />
                          <Input
                            placeholder="Value (e.g., Blue)"
                            value={attr.value}
                            onChange={(e) =>
                              updateAttribute(index, "value", e.target.value)
                            }
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-purple-500 transition-all hover:bg-white/15 rounded-2xl py-4"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAttribute(index)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 transform hover:scale-110 transition-all w-12 h-12 rounded-2xl"
                          >
                            <X className="w-5 h-5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Button
                  onClick={handleMint}
                  disabled={isMinting || !isConnected}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 text-white border-0 py-6 rounded-2xl text-xl font-bold shadow-2xl shadow-purple-500/25"
                  size="lg"
                >
                  {isMinting ? (
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{mintingStep || "Creating Your NFT..."}</span>
                    </div>
                  ) : !isConnected ? (
                    <>
                      <Zap className="w-6 h-6 mr-3" />
                      Connect Wallet to Create
                    </>
                  ) : (
                    <>
                      <Zap className="w-6 h-6 mr-3" />
                      List NFT
                      <Sparkles className="w-6 h-6 ml-3" />
                    </>
                  )}
                </Button>

                <div className="text-center text-white/60 text-lg bg-white/5 rounded-2xl p-6 backdrop-blur-xl">
                
                  <p className="text-sm">
                    By creating, you agree to our terms of service and confirm
                    that you own the rights to this content.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
