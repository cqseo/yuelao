import { createFileRoute, redirect } from '@tanstack/react-router';

// 問月老對話已拿掉（2026-11-13）。舊連結導到月老殿求籤。
export const Route = createFileRoute('/chat')({
  beforeLoad: () => {
    throw redirect({ href: '/market#yuelao', statusCode: 301 });
  },
});
