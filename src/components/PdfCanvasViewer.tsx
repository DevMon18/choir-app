'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface PdfCanvasViewerProps {
  url: string;
  title?: string;
  height?: string;
}

export const PdfCanvasViewer = ({ url, title, height = '450px' }: PdfCanvasViewerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
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

      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth || 600;
      const padding = window.innerWidth < 640 ? 16 : 32;
      const targetWidth = Math.min(containerWidth - padding, 740);
      const scale = targetWidth > 0 ? targetWidth / unscaledViewport.width : 1.0;

      const viewport = page.getViewport({ scale: Math.max(scale, 0.55) });
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
        }, 60);
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

  // Re-render on window resize for responsive scaling
  useEffect(() => {
    const handleResize = () => {
      if (pdfDocRef.current && currentPage) {
        renderPage(currentPage);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentPage, renderPage]);

  const changePage = (nextPage: number) => {
    if (nextPage >= 1 && nextPage <= numPages) {
      setCurrentPage(nextPage);
      renderPage(nextPage);
      // Scroll canvas viewport to top when switching page
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
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
        height: '100%',
        width: '100%',
      }}
    >
      {/* Top Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(11,77,36,0.06)',
          borderBottom: '1px solid var(--glass-border)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {numPages > 1 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => changePage(1)}
                className={`btn ${currentPage === 1 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600 }}
              >
                Page 1 (Letter)
              </button>
              <button
                type="button"
                onClick={() => changePage(2)}
                className={`btn ${currentPage === 2 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600 }}
              >
                Page 2 (Waiver)
              </button>
            </div>
          )}

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Open PDF ↗</span>
          </a>
        </div>
      </div>

      {/* PDF Viewport Body (Scrollable Container) */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          maxHeight: '68vh',
          minHeight: '340px',
          overflowY: 'auto',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background: '#525659',
          padding: '16px 8px',
          boxSizing: 'border-box',
        }}
      >
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#ffffff', margin: 'auto' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading document page…</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: 'center', color: '#ffffff', padding: '32px 16px', maxWidth: '380px', margin: 'auto' }}>
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
            boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
            borderRadius: '4px',
            background: '#ffffff',
            margin: '0 auto',
          }}
        />

        {numPages > 1 && !loading && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', padding: '8px 16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', borderRadius: '999px', color: '#fff', fontSize: '0.8rem' }}>
            <button
              type="button"
              onClick={() => changePage(currentPage - 1)}
              disabled={currentPage <= 1}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: currentPage <= 1 ? 0.4 : 1, fontWeight: 700 }}
            >
              ◀ Prev Page
            </button>
            <span>Page {currentPage} of {numPages}</span>
            <button
              type="button"
              onClick={() => changePage(currentPage + 1)}
              disabled={currentPage >= numPages}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: currentPage >= numPages ? 0.4 : 1, fontWeight: 700 }}
            >
              Next Page ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
