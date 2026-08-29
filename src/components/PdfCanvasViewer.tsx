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
    <div className="pdf-canvas-viewer-container rounded-xl border border-glass-border bg-white overflow-hidden flex flex-col shadow-sm h-full w-full">
      {/* Top Controls Toolbar */}
      <div className="flex items-center justify-between p-2.5 sm:px-3.5 bg-primary/6 border-b border-glass-border flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-primary">
            📄 {title || 'Document Preview'}
          </span>
          {numPages > 0 && (
            <span className="badge text-xs bg-primary/12 text-primary font-bold">
              Page {currentPage} of {numPages}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {numPages > 1 && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => changePage(1)}
                className={`btn !py-1 !px-2.5 text-xs font-semibold ${currentPage === 1 ? 'btn-primary' : 'btn-secondary'}`}
              >
                Page 1 (Letter)
              </button>
              <button
                type="button"
                onClick={() => changePage(2)}
                className={`btn !py-1 !px-2.5 text-xs font-semibold ${currentPage === 2 ? 'btn-primary' : 'btn-secondary'}`}
              >
                Page 2 (Waiver)
              </button>
            </div>
          )}

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
          >
            <span>Open PDF ↗</span>
          </a>
        </div>
      </div>

      {/* PDF Viewport Body (Scrollable Container) */}
      <div
        ref={containerRef}
        className="flex-1 w-full max-h-[68vh] min-h-[340px] overflow-y-auto overflow-x-auto flex flex-col items-center justify-start bg-[#525659] p-4 sm:p-2 box-border"
      >
        {loading && (
          <div className="flex flex-col items-center gap-3 text-white m-auto">
            <div className="w-8 h-8 border-3 border-white/20 border-t-accent rounded-full animate-spin" />
            <span className="text-sm font-semibold">Loading document page…</span>
          </div>
        )}

        {error && !loading && (
          <div className="text-center text-white p-8 sm:px-4 max-w-[380px] m-auto">
            <div className="text-4xl mb-2">📄</div>
            <p className="font-bold text-base m-0 mb-1.5">
              Document Ready
            </p>
            <p className="text-xs text-gray-300 m-0 mb-4">
              Tap below to view or download the complete PDF file.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary text-sm !py-2.5 !px-5 w-full inline-block"
            >
              📄 Tap to Open PDF Document ↗
            </a>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`max-w-full h-auto shadow-2xl rounded bg-white mx-auto ${
            loading || error ? 'hidden' : 'block'
          }`}
        />

        {numPages > 1 && !loading && !error && (
          <div className="flex items-center gap-3 mt-4 py-2 px-4 bg-black/40 backdrop-blur-sm rounded-full text-white text-xs">
            <button
              type="button"
              onClick={() => changePage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="bg-transparent border-0 text-white cursor-pointer font-bold disabled:opacity-40"
            >
              ◀ Prev Page
            </button>
            <span>Page {currentPage} of {numPages}</span>
            <button
              type="button"
              onClick={() => changePage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="bg-transparent border-0 text-white cursor-pointer font-bold disabled:opacity-40"
            >
              Next Page ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
