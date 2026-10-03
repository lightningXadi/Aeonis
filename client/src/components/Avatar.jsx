import './Avatar.css';

// Real SVG assets (Twemoji, CC-BY 4.0) so every device shows identical art
// instead of its own emoji font.
const CREATURE_SRC = {
  fox: '/emoji/fox.svg',
  owl: '/emoji/owl.svg',
  rabbit: '/emoji/rabbit.svg',
  deer: '/emoji/deer.svg'
};

/**
 * Forest-creature avatar. `online` shows a sage presence dot; `ring` adds a
 * terracotta rim (used for the "you" avatar on profile / call screens).
 */
export default function Avatar({ seed = 'fox', size = 44, online, ring = false }) {
  const src = CREATURE_SRC[seed] || CREATURE_SRC.fox;
  return (
    <span
      className={`avatar avatar--${seed}${ring ? ' avatar--ring' : ''}`}
      style={{ width: size, height: size }}
    >
      <img src={src} alt="" className="avatar__img" style={{ width: size * 0.62, height: size * 0.62 }} />
      {online && <span className="avatar__online-dot" title="Online" />}
    </span>
  );
}
