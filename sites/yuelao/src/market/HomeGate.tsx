import { Link } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import { localizeHref } from '~/paraglide/runtime.js';
import './home-gate.css';

// 首頁第一屏：集市的入口。這裡只有一張圖和幾個連結，3D 本身在 /market 才載入，
// 所以首頁仍然打開就能用（鐵律：首屏零等待）。
const ROOMS = [
  {
    img: '/market/yuelao.jpg',
    name: () => m.home_market_room_yuelao(),
    desc: () => m.home_market_room_yuelao_desc(),
    hash: 'yuelao',
  },
  {
    img: '/market/tarot.jpg',
    name: () => m.home_market_room_tarot(),
    desc: () => m.home_market_room_tarot_desc(),
    hash: 'tarot',
  },
  {
    img: '/market/hall.jpg',
    name: () => m.home_market_room_hall(),
    desc: () => m.home_market_room_hall_desc(),
  },
];

export function HomeGate() {
  return (
    <section className="gate" aria-labelledby="gate-title">
      <div className="gate-hero">
        <img className="gate-img" src="/market/plaza.jpg" alt="" fetchPriority="high" />
        <div className="gate-copy">
          <h1 id="gate-title">{m.home_market_title()}</h1>
          <p className="gate-lead">{m.home_market_lead()}</p>
          <div className="gate-actions">
            <a className="gate-enter" href="/market" data-rybbit-event="home_market_enter">
              {m.home_market_enter()}
            </a>
            <Link className="gate-plain" to={localizeHref('/ritual')}>
              {m.home_market_plain()}
            </Link>
          </div>
          <p className="gate-note">{m.home_market_note()}</p>
        </div>
      </div>

      <div className="gate-rooms">
        <h2>{m.home_market_rooms()}</h2>
        <ul>
          {ROOMS.map((r) => (
            <li key={r.img}>
              <img src={r.img} alt="" loading="lazy" width={900} height={675} />
              <h3>{r.name()}</h3>
              <p>{r.desc()}</p>
              {r.hash ? (
                <a href={`/market#${r.hash}`} data-rybbit-event={`home_market_room_${r.hash}`}>
                  {m.home_market_room_go()}
                </a>
              ) : (
                <span>{m.home_market_room_soon()}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="gate-more">
          <Link to={localizeHref('/chat')}>{m.home_market_chat()}</Link>
          <Link to={localizeHref('/daily')}>{m.home_market_daily()}</Link>
        </p>
      </div>
    </section>
  );
}
