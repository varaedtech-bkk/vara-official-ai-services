export function initials(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'W';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function BrandMark({
  logoUrl,
  companyName,
  size = 32,
}: {
  logoUrl?: string;
  companyName?: string;
  size?: number;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={companyName || 'Workspace'}
        className="dash-logo"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="dash-mark" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(companyName)}
    </div>
  );
}
