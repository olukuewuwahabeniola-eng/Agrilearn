import { useCallback, useEffect, useState } from "react";

export function useDocumentPreview() {
  const [doc, setDoc] = useState(null);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const revoke = useCallback((list) => {
    (list || []).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }, []);

  const close = useCallback(() => {
    setUrls((current) => {
      revoke(current);
      return [];
    });
    setDoc(null);
    setError("");
    setLoading(false);
  }, [revoke]);

  const open = useCallback(
    async (item, loadUrls) => {
      setDoc(item);
      setLoading(true);
      setError("");
      setUrls((current) => {
        revoke(current);
        return [];
      });
      try {
        const next = await loadUrls(item);
        setUrls(Array.isArray(next) ? next.filter(Boolean) : []);
      } catch (err) {
        setError(err.message || "Could not open that file.");
        setDoc(null);
      } finally {
        setLoading(false);
      }
    },
    [revoke]
  );

  useEffect(() => {
    return () => revoke(urls);
  }, [revoke, urls]);

  return { doc, urls, loading, error, open, close };
}
