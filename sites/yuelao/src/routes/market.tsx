import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '~/i18n/seo';
import { tr } from '~/i18n/ui';
import { Market } from '~/market/Market';
import { m } from '~/paraglide/messages.js';
import { getLocale, localizeHref } from '~/paraglide/runtime.js';
import site from '../../site.config';

// 分享出去的鋪子連結帶 ?room=（集市本身用 #hash 換房間，爬蟲看不到 hash）：
// 貼到 Threads、LINE 等時，預覽用該鋪子的標題、說明和圖（2026-11-19）。
const ROOMS: Record<string, { title: string; description: string; image: string }> = {
  yuelao: {
    title: '月老殿．線上求籤擲筊',
    description: '走進3D月老殿搖籤、擲筊確認，讀籤詩與白話解讀。免費、免登入。',
    image: '/og/yuelao.jpg',
  },
  tarot: {
    title: '塔羅館．三張牌',
    description: '寫下想問的事，抽三張塔羅或雷諾曼，免費看牌義。',
    image: '/og/tarot.jpg',
  },
  bazi: {
    title: '算命攤．合緣配對、姻緣盤、八字',
    description:
      '填生日（公曆、農曆都可以），看兩個人合不合、自己的桃花與紅鸞，或排八字看感情、事業、財運與年運。',
    image: '/og/bazi.jpg',
  },
  caishen: {
    title: '財神殿．求財籤',
    description: '上香、搖籤筒，求一支財運或事業的籤，免費看籤解。',
    image: '/og/caishen.jpg',
  },
};

export const Route = createFileRoute('/market')({
  validateSearch: (search: Record<string, unknown>): { room?: string } =>
    typeof search.room === 'string' && search.room in ROOMS ? { room: search.room } : {},
  head: ({ match }) => {
    const room = match.search.room ? ROOMS[match.search.room] : undefined;
    const zh = getLocale() === 'zh-Hant' || getLocale() === 'zh-Hans';
    return pageHead(site, {
      title:
        room && zh ? `${room.title}｜${tr(site.name)}` : m.common_market_meta_title({ name: tr(site.name) }),
      description: room && zh ? room.description : m.common_market_meta_description(),
      path: localizeHref('/market', { locale: getLocale() }),
      image: `${site.url}${room?.image ?? '/og/market.jpg'}`,
    });
  },
  component: Market,
});
