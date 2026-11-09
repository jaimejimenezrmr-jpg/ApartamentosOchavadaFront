/** Lado mayor de las fotos que se suben: suficiente para ver detalles sin gastar datos móviles. */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

/**
 * Reduce y convierte a JPEG una foto tomada con el móvil antes de subirla (de 4–8 MB a unos 300–600 KB).
 * Además elimina los metadatos (incluida la ubicación GPS) porque solo se envían los píxeles.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') && file.type !== '') {
    throw new Error('El archivo no es una imagen');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No se puede leer esta imagen. Pruebe a hacer la foto en formato JPEG');
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('El navegador no permite procesar la imagen');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo preparar la foto'))), 'image/jpeg', QUALITY),
    );
  } finally {
    bitmap.close();
  }
}
