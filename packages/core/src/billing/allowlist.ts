// 測試結帳的白名單：測試卡號（4242…）是公開的，任何人拿來「買」都會真的花掉 AI 生成的費用。
// 所以測試結帳只開給名單上的信箱；名單沒設或是空的，就誰都不開（fail closed）。
// 名單用逗號分隔，比對時不分大小寫、去掉空白。

export function parseAllowlist(value: unknown): Set<string> {
  if (typeof value !== 'string') return new Set();
  return new Set(
    value
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)),
  );
}

export function testCheckoutAllowed(list: unknown, email: unknown): boolean {
  if (typeof email !== 'string') return false;
  return parseAllowlist(list).has(email.trim().toLowerCase());
}
