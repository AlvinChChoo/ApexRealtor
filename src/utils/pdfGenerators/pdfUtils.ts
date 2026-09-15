let __pdfMakeOnce: Promise<any> | null = null;

export function ensurePdfMakeOnce() {
  if (__pdfMakeOnce) return __pdfMakeOnce;
  __pdfMakeOnce = (async () => {
    const mod: any = await import("pdfmake/build/pdfmake.js");
    const pdfMake = mod?.default || mod?.pdfMake || (window as any)?.pdfMake;
    if (!pdfMake) throw new Error("pdfMake instance not found");

    const fonts: any = await import("pdfmake/build/vfs_fonts.js");
    const hasRoboto = (o: any) =>
      o &&
      typeof o === "object" &&
      ("Roboto-Regular.ttf" in o || "Roboto-Medium.ttf" in o);
    const vfs =
      fonts?.pdfMake?.vfs ||
      fonts?.default?.pdfMake?.vfs ||
      fonts?.vfs ||
      fonts?.default?.vfs ||
      (hasRoboto(fonts) ? fonts : undefined) ||
      (hasRoboto(fonts?.default) ? fonts.default : undefined);
    if (!vfs) throw new Error("pdfmake vfs not found");

    pdfMake.vfs = vfs;
    if (typeof pdfMake.createPdf !== "function")
      throw new Error("pdfMake.createPdf is not a function");
    return pdfMake;
  })();
  return __pdfMakeOnce;
}

export async function assetToDataUrl(pathFromPublicRoot: string): Promise<string> {
  const url = new URL(pathFromPublicRoot, window.location.origin).toString();
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => res(el);
    el.onerror = () => rej(new Error("Image failed to load: " + pathFromPublicRoot));
    el.src = url + "?v=" + Date.now();
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}
