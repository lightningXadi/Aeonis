import BorderGlow from './reactbits/BorderGlow';
import './HeroButton.css';

/**
 * The two hero CTAs on the landing page ("Join Aeris" / "Re-enter Aeris").
 * BorderGlow is used ONLY here, by design — it's reserved for these two
 * buttons so the glow reads as "this is the important action", not spread
 * thin across every card in the app.
 */
export default function HeroButton({ label, onClick, variant = 'primary', animated = false }) {
  const isPrimary = variant === 'primary';

  return (
    <BorderGlow
      className="hero-btn-glow"
      backgroundColor={isPrimary ? '#D97746' : '#29231F'}
      borderRadius={999}
      glowRadius={22}
      glowIntensity={isPrimary ? 1.6 : 2.4}
      edgeSensitivity={0}
      coneSpread={30}
      animated={animated}
      fillOpacity={0.35}
      colors={isPrimary
        ? ['#F0A279', '#D97746', '#D89A38']   /* terracotta -> honey glow */
        : ['#7E9A7A', '#D89A38', '#D97746']}  /* sage -> honey -> terracotta glow */
      glowColor={isPrimary ? '20 68% 60%' : '105 18% 55%'}
    >
      <button className={`hero-btn ${isPrimary ? 'hero-btn--primary' : 'hero-btn--secondary'}`} onClick={onClick}>
        {label}
      </button>
    </BorderGlow>
  );
}
