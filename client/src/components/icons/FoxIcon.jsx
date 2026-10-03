export default function FoxIcon({ size = 24, color = 'currentColor', strokeWidth = 1.8, className = '', ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <path d="M12 4 L6 10 Q6 17 12 20 Q18 17 18 10 Z" />
      <path d="M6 10 L2.5 3.5 L9 7.5" />
      <path d="M18 10 L21.5 3.5 L15 7.5" />
      <circle cx="9.3" cy="12.5" r="0.9" fill={color} stroke="none" />
      <circle cx="14.7" cy="12.5" r="0.9" fill={color} stroke="none" />
      <path d="M12 15.5 L12 17.2" />
    </svg>
  );
}
