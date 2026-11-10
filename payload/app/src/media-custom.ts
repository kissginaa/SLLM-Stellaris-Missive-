import { app, nativeImage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export * from './media-prefs';
import { PAPERS } from './galnews';
import { MEDIA_FAMILIES, MediaPrefs, defaultPersona } from './media-prefs';
import { L } from './i18n-pick';
function brandFile(id: string, kind: string): string {
  if (!MEDIA_FAMILIES.some((f) => f.id === id) || !['paper', 'radio', 'web'].includes(kind)) throw new Error(L('알 수 없는 브랜드입니다.', 'Unknown brand.'));
  return path.join(app.getPath('userData'), 'media-brands', id + '-' + kind + '.png');
}
export function brandData(id: string, kind: string): string | null {
  try { return 'data:image/png;base64,' + fs.readFileSync(brandFile(id, kind)).toString('base64'); } catch { return null; }
}
export function storeBrand(id: string, kind: string, source: string): void {
  const dest = brandFile(id, kind);
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(source).toLowerCase())) throw new Error(L('PNG, JPG, WEBP 그림을 선택하세요.', 'Choose a PNG, JPG or WEBP image.'));
  if (fs.statSync(source).size > 8 * 1024 * 1024) throw new Error(L('8MB 이하의 그림을 선택하세요.', 'Choose an image of 8 MB or less.'));
  let img = nativeImage.createFromBuffer(fs.readFileSync(source));
  if (img.isEmpty()) throw new Error(L('이 그림을 읽을 수 없습니다. PNG 또는 JPG로 다시 저장해 주세요.', 'This image cannot be read. Please save it again as PNG or JPG.'));
  const size = img.getSize();
  if (Math.max(size.width, size.height) > 512) img = img.resize(size.width >= size.height ? { width: 512 } : { height: 512 });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, img.toPNG());
}
export function resetBrand(id: string, kind: string): void {
  const file = brandFile(id, kind); if (fs.existsSync(file)) fs.unlinkSync(file);
}
export function mediaView(prefs: MediaPrefs) {
  return MEDIA_FAMILIES.map((f, i) => ({ ...f, name: prefs[i]?.paperName || PAPERS[i].name, radio: prefs[i]?.radioName || f.radio, defaultName: PAPERS[i].name, defaultRadio: f.radio, persona: prefs[i]?.persona || defaultPersona(i, L),
    comments: prefs[i]?.comments ?? PAPERS[i].comments, customized: !!prefs[i]?.persona, font: prefs[i]?.font || 'auto',
    paperImage: brandData(f.id, 'paper'), radioImage: brandData(f.id, 'radio'), webImage: brandData(f.id, 'web') })); // web = 집무실 홈페이지 로고(2026-11-10, 신문 그림과 따로)
}
