// 結型實拍圖（P8）：三種結各一張生成圖，裁到繩結 + 邊緣羽化透明、WebP。
// 判詞卡與籤頁共用同一份對照，按籤的 knot（tongxin / huo / hua）取圖。
// P8-fix：圖已真去背（透明底），直接顯示、不用 mix-blend-mode。
const FALLBACK = '/ritual/knot-tongxin.webp';

export const KNOT_IMAGE: Record<string, string> = {
  tongxin: FALLBACK,
  huo: '/ritual/knot-huo.webp',
  hua: '/ritual/knot-hua.webp',
};

export function knotImage(knot: string): string {
  return KNOT_IMAGE[knot] ?? FALLBACK;
}
