'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface PdfCanvasViewerProps {
  url: string;
  title?: string;
  height?: string;
}

export const PdfCanvasViewer = ({ url, title, height = '450px' }: PdfCanvasViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const pdfDocRef = useRef<any>(null);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const viewport = page.getViewport({ scale: 1.2 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('[PdfCanvasViewer] Render page error:', err);
      setError(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    const loadPdfJs = async () => {
      try {
        // Ensure pdfjsLib is loaded in browser window
        if (!(window as any).pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load PDF.js script'));
            document.head.appendChild(script);
          });
        }

        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          throw new Error('PDF.js not available');
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: false,
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);

        setTimeout(() => {
          if (isMounted) renderPage(1);
        }, 50);
      } catch (err) {
        console.error('[PdfCanvasViewer] Failed to load PDF:', err);
        if (isMounted) {
          setLoading(false);
          setError(true);
        }
      }
    };

    if (url) {
      loadPdfJs();
    }

    return () => {
      isMounted = false;
    };
  }, [url, renderPage]);

  const changePage = (delta: number) => {
    const next = currentPage + delta;
    if (next >= 1 && next <= numPages) {
      setCurrentPage(next);
      renderPage(next);
    }
  };

  return (
    <div
      className="pdf-canvas-viewer-container"
      style={{
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
        background: '#ffffff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      {/* Top Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'rgba(11,77,36,0.06)',
          borderBottom: '1px solid var(--glass-border)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary)' }}>
            📄 {title || 'Document Preview'}
          </span>
          {numPages > 0 && (
            <span
              className="badge"
              style={{
                fontSize: '0.75rem',
                background: 'rgba(11,77,36,0.12)',
                color: 'var(--primary)',
                fontWeight: 700,
              }}
            >
              Page {currentPage} of {numPages}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {numPages > 1 && (
            <>
              <button
                type="button"
                onClick={() => changePage(-1)}
                disabled={currentPage <= 1}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                ◀ Prev
              </button>
              <button
                type="button"
                onClick={() => changePage(1)}
                disabled={currentPage >= numPages}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                Next ▶
              </button>
            </>
          )}

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Open PDF ↗</span>
          </a>
        </div>
      </div>

      {/* PDF Viewport Body */}
      <div
        style={{
          flex: 1,
          minHeight: height,
          maxHeight: '70vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#525659',
          padding: '16px',
          position: 'relative',
        }}
      >
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#ffffff' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading PDF document…</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: 'center', color: '#ffffff', padding: '32px 16px', maxWidth: '380px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📄</div>
            <p style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 6px' }}>
              Document Ready
            </p>
            <p style={{ fontSize: '0.85rem', color: '#d1d5db', margin: '0 0 16px' }}>
              Tap below to view or download the complete PDF file.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ fontSize: '0.9rem', padding: '10px 20px', width: '100%' }}
            >
              📄 Tap to Open PDF Document ↗
            </a>
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            height: 'auto',
            display: loading || error ? 'none' : 'block',
            boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
            borderRadius: '4px',
            background: '#ffffff',
          }}
        />
      </div>
    </div>
  );
};
