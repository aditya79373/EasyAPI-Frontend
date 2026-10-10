import { Link } from 'react-router-dom';
import { Activity, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="not-found app-grid">
      <Link to="/" className="brand" aria-label="Serverpulse home">
        <span className="brand-mark"><Activity size={18}/></span>
        <span>server<span>pulse</span></span>
      </Link>
      <div className="not-found-body">
        <span className="not-found-code">404 <i/></span>
        <h1>That route is off the map.</h1>
        <p>The page may have moved, or this endpoint does not exist.</p>
        <Link to="/dashboard" className="btn btn-primary"><ArrowLeft size={15}/> Back to workspace</Link>
      </div>
      <div className="not-found-footer">Serverpulse · API operations workspace</div>
    </main>
  );
}
