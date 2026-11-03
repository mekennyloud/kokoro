// Картинки в записях. Хранятся прямо в записи строкой data:…, поэтому синхронизируются как всё остальное.
// Чтобы база не разрасталась, большие фото уменьшаются до MAX px по длинной стороне.
// Маленькие PNG (стикеры с прозрачностью) и GIF (живые мемы) остаются как есть.
const MAX = 1280;
const KEEP_AS_IS = 1.5 * 1024 * 1024;

const readAsDataURL = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

export async function fileToImage(file) {
  if (/image\/(gif|png)/.test(file.type) && file.size <= KEEP_AS_IS) return readAsDataURL(file);
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

/** открыть выбор фото (на iPhone — галерея или камера) */
export function pickImage() {
  return new Promise(resolve => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    input.onchange = async () => resolve(input.files[0] ? await fileToImage(input.files[0]) : null);
    input.click();
  });
}
