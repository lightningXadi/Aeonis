import BorderGlow from './reactbits/BorderGlow';
import './HeroButton.css';

/**
 * The two hero CTAs on the landing page ("Join Aeonis" / "Re-enter Aeonis").
 * BorderGlow is used ONLY here, by design — it's reserved for these two
 * buttons so the glow reads as "this is the important action", not spread
 * thin across every card in the app.
 */
export default function HeroButton({ label, onClick, variant = 'primary', animated = false }) {
  const isPrimary = variant === 'primary';

  return (
    <BorderGlow
      className="hero-btn-glow"
      backgroundColor={isPrimary ? '#E8916B' : '#2E2620'}
      borderRadius={999}
      glowRadius={22}
      glowIntensity={isPrimary ? 1.6 : 2.4}
      edgeSensitivity={0}
      coneSpread={30}
      animated={animated}
      fillOpacity={0.35}
      colors={isPrimary
        ? ['#F2B48C', '#E8916B', '#C9A66B']   /* warm coral -> tan glow */
        : ['#8FA382', '#C9A66B', '#E8916B']}  /* sage -> tan -> coral glow */
      glowColor={isPrimary ? '18 75% 72%' : '95 25% 60%'}
    >
      <button className={`hero-btn ${isPrimary ? 'hero-btn--primary' : 'hero-btn--secondary'}`} onClick={onClick}>
        {label}
      </button>
    </BorderGlow>
  );
}
