/**
 * Image optimization utilities for mobile uploads.
 *
 * Uses the Canvas API (works in WebView / Capacitor).
 * Resizes and compresses images before sending to the server
 * to reduce upload time and bandwidth on mobile networks.
 */

const DEFAULT_MAX_WIDTH = 1920
const DEFAULT_MAX_HEIGHT = 1920
const DEFAULT_QUALITY = 0.8

/**
 * Load a File/Blob as an HTMLImageElement.
 */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Не удалось загрузить изображение'))
    }
    img.src = url
  })
}

/**
 * Calculate new dimensions that fit within maxWidth x maxHeight
 * while preserving the aspect ratio.
 */
function fitDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height }
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

/**
 * Render an image onto a canvas at the given dimensions and export as Blob.
 */
function canvasToBlob(
  img: HTMLImageElement,
  width: number,
  height: number,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Canvas 2D context недоступен'))
      return
    }

    ctx.drawImage(img, 0, 0, width, height)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Не удалось создать Blob из Canvas'))
        }
      },
      mimeType,
      quality,
    )
  })
}

/**
 * Determine the output MIME type — use JPEG for lossy compression,
 * keep PNG for transparent images. WebP input stays as WebP.
 */
function resolveOutputType(file: File): string {
  if (file.type === 'image/png') return 'image/png'
  if (file.type === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

/**
 * Resize an image to fit within `maxWidth` x `maxHeight` while
 * preserving the aspect ratio. Images smaller than the limit
 * are returned at their original size but still re-encoded
 * at the specified quality.
 *
 * @param file       Source image file
 * @param maxWidth   Maximum output width (default 1920)
 * @param maxHeight  Maximum output height (default 1920)
 * @param quality    Compression quality 0-1 (default 0.8)
 * @returns          Resized image as Blob
 */
export async function resizeImage(
  file: File,
  maxWidth: number = DEFAULT_MAX_WIDTH,
  maxHeight: number = DEFAULT_MAX_HEIGHT,
  quality: number = DEFAULT_QUALITY,
): Promise<Blob> {
  const img = await loadImage(file)
  const { width, height } = fitDimensions(
    img.naturalWidth,
    img.naturalHeight,
    maxWidth,
    maxHeight,
  )
  const mimeType = resolveOutputType(file)
  return canvasToBlob(img, width, height, mimeType, quality)
}

/**
 * Compress an image without changing its dimensions.
 * Useful for photos that are already the right size but
 * too heavy in file size.
 *
 * @param file     Source image file
 * @param quality  Compression quality 0-1 (default 0.8)
 * @returns        Compressed image as Blob
 */
export async function compressImage(
  file: File,
  quality: number = DEFAULT_QUALITY,
): Promise<Blob> {
  const img = await loadImage(file)
  const mimeType = resolveOutputType(file)
  return canvasToBlob(
    img,
    img.naturalWidth,
    img.naturalHeight,
    mimeType,
    quality,
  )
}
