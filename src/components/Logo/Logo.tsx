import './Logo.css';

interface LogoProps {
  showText?: boolean;
  collapsedText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function Logo({ showText = true, collapsedText = false, size = 'medium' }: LogoProps) {
  return (
    <div className={`logo-container logo-${size}`}>
      <span className="logo-text">
        UP{collapsedText ? '' : ' Gestão'}
      </span>
    </div>
  );
}

