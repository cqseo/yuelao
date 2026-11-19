import { createCore } from '@yuelao/core/server';
import { caiContext } from '~/ritual/caishen';
import { stickContext } from '~/ritual/stick-context';
import site from '../site.config';

// Server singleton: route files only delegate; business logic lives in packages.
// stickContext：付費解籤讀籤頁上的同一份籤內容（不是資料庫的舊籤文）。
// caiContext：財神殿求財籤的籤內容（本站原創，見 ritual/caishen.ts）。
export const core = createCore(site, { stickContext, caiContext });
