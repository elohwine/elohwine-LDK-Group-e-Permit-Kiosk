import { useEffect, useState } from 'react';

export default function ShareTarget() {
  const [data, setData] = useState(null);
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const title = url.searchParams.get('title') || '';
      const text = url.searchParams.get('text') || '';
      const link = url.searchParams.get('url') || '';
      setData({ title, text, url: link });
    } catch {}
  }, []);
  return (
    <main style={{ padding: 16 }}>
      <h1>Share Target</h1>
      <pre aria-label="shared-data">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
