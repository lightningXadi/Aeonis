export default function OwlIcon({ size = 24, color = 'currentColor', strokeWidth = 1.8, className = '', ...rest }) {
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
      <path d="M8 6 L6.3 2.2 L10.2 5.2" />
      <path d="M16 6 L17.7 2.2 L13.8 5.2" />
      <path d="M12 5.5c-3.8 0-6.5 3-6.5 7S8.2 20 12 20s6.5-3.5 6.5-7.5S15.8 5.5 12 5.5Z" />
      <circle cx="9" cy="12.5" r="2.3" />
      <circle cx="15" cy="12.5" r="2.3" />
      <circle cx="9" cy="12.5" r="0.6" fill={color} stroke="none" />
      <circle cx="15" cy="12.5" r="0.6" fill={color} stroke="none" />
      <path d="M12 15 L10.7 17.3 L13.3 17.3 Z" />
    </svg>
  );
}
