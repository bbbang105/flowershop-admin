/**
 * PWA 아이콘 생성 스크립트
 * Node.js로 SVG → PNG 변환 없이, SVG 자체를 아이콘으로 사용
 * 실제 프로덕션에서는 디자이너가 만든 PNG를 사용하는 것을 권장
 *
 * 임시로 간단한 SVG 아이콘을 생성합니다.
 */
import { writeFileSync } from 'fs';

const sizes = [192, 512];

function generateSVG(size, maskable = false) {
  const padding = maskable ? size * 0.1 : 0;
  const innerSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = innerSize * 0.35;
  const subFontSize = innerSize * 0.12;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#E5614E" rx="${maskable ? 0 : size * 0.15}"/>
  <text x="${cx}" y="${cy - fontSize * 0.1}" font-family="sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">H</text>
  <text x="${cx}" y="${cy + fontSize * 0.7}" font-family="sans-serif" font-size="${subFontSize}" font-weight="400" fill="rgba(255,255,255,0.8)" text-anchor="middle" dominant-baseline="central">hazel</text>
</svg>`;
}

for (const size of sizes) {
  writeFileSync(`public/icons/icon-${size}x${size}.svg`, generateSVG(size, false));
  writeFileSync(`public/icons/icon-maskable-${size}x${size}.svg`, generateSVG(size, true));
  console.log(`Generated ${size}x${size} icons`);
}

console.log('\n⚠️  SVG 아이콘이 생성되었습니다.');
console.log('프로덕션에서는 PNG 아이콘으로 교체해주세요.');
console.log('온라인 도구: https://maskable.app/editor');
