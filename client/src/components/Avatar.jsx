import './Avatar.css';

const CREATURE_EMOJI = { fox: '🦊', owl: '🦉', rabbit: '🐇', deer: '🦌' };

/**
 * Renders the same deterministic "forest creature" avatar concept from the
 * original Whisper prototype (seed comes from the backend — fox/owl/rabbit/
 * deer — no image uploads needed for this). Recolored to Aeonis's warm
 * palette instead of Whisper's original colors.
 */
export default function Avatar({ seed = 'fox', size = 44, online }) {
  const emoji = CREATURE_EMOJI[seed] || '🦊';
  return (
    <span
      className={`avatar avatar--${seed}`}
      style={{ width: size, height: size, fontSize: size * 0.52 }}
    >
      {emoji}
      {online && <span className="avatar__online-dot" />}
    </span>
  );
}
