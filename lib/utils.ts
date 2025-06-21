import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const resolveURL = (a:string)=>{
return process.env.NODE_ENV == "production"? window.location.origin+a:a
}