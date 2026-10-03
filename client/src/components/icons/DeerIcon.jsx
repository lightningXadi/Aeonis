export default function DeerIcon({ size = 24, color = 'currentColor', strokeWidth = 1.8, className = '', ...rest }) {
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
      <path d="M8 7.5C7 4.5 5 3.8 3.5 4.8c.5 1.3 1.5 2 2.8 2" />
      <path d="M16 7.5c1-3 3-3.7 4.5-2.7c-.5 1.3-1.5 2-2.8 2" />
      <path d="M9.3 5.8C8.6 3.6 7.3 3.2 6.3 4c.4 1 1.1 1.5 2 1.5" />
      <path d="M14.7 5.8c.7-2.2 2-2.6 3-1.8c-.4 1-1.1 1.5-2 1.5" />
      <path d="M8 9 Q8 16.5 12 20 Q16 16.5 16 9 Q14 6.5 12 6.5 Q10 6.5 8 9Z" />
      <circle cx="10" cy="13" r="0.9" fill={color} stroke="none" />
      <circle cx="14" cy="13" r="0.9" fill={color} stroke="none" />
    </svg>
  );
}
