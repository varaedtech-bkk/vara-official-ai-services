import './dashboard.css';

/**
 * The site-wide stylesheet locks html/body to overflow:hidden for the
 * single-screen voice experience. Dashboard pages need a dedicated
 * scroll surface so logs, transcripts, and the email list can be read.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', overflow: 'hidden', background: '#f3f4f6', color: '#111318' }}>
      {children}
    </div>
  );
}
