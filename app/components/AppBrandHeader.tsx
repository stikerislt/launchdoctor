interface AppBrandHeaderProps {
  title: string;
  subtitle?: string;
}

export function AppBrandHeader({ title, subtitle }: AppBrandHeaderProps) {
  return (
    <div className="ld-page-header">
      <img src="/launch-doctor-icon.png" alt="Launch Doctor" />
      <div className="ld-page-header-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}
