// 算命攤：使用者自己選擇「在這台裝置記住我的生日」時，只存在本機 localStorage（不送伺服器、不進統計）。
// 取消勾選就刪掉。讀寫都包 try/catch：無痕模式或封鎖網站資料時就當沒記。

const KEY = 'yuelao:birthday';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function loadBirthday(): string {
  try {
    const v = localStorage.getItem(KEY) ?? '';
    return DATE.test(v) ? v : '';
  } catch {
    return '';
  }
}

export function keepBirthday(date: string, keep: boolean): void {
  try {
    if (keep && DATE.test(date)) localStorage.setItem(KEY, date);
    else localStorage.removeItem(KEY);
  } catch {}
}
