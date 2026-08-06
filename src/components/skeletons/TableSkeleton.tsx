import React from 'react';

export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => {
  return (
    <div
      className="skeleton-glass-card"
      style={{
        padding: '24px',
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Header & Controls Skeleton */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="skeleton-text" style={{ width: '180px', height: '22px' }} />
          <div className="skeleton-text" style={{ width: '120px', height: '12px' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="skeleton-pill" style={{ width: '180px', height: '38px' }} />
          <div className="skeleton-pill" style={{ width: '110px', height: '38px' }} />
        </div>
      </div>

      {/* Table Rows Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
        {Array.from({ length: rows }).map((_, i) => {
          // Vary text widths for an organic, non-static visual design
          const titleWidth = `${55 + (i * 7) % 30}%`;
          const badgeWidth = `${60 + (i * 13) % 25}px`;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.45)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 35%' }}>
                <div className="skeleton-circle" style={{ width: '40px', height: '40px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: titleWidth }}>
                  <div className="skeleton-text" style={{ width: '100%', height: '14px' }} />
                  <div className="skeleton-text" style={{ width: '60%', height: '10px' }} />
                </div>
              </div>

              <div style={{ flex: '1 1 20%', display: 'flex', justifyContent: 'center' }}>
                <div className="skeleton-pill" style={{ width: badgeWidth, height: '22px' }} />
              </div>

              <div style={{ flex: '1 1 20%', display: 'flex', justifyContent: 'center' }}>
                <div className="skeleton-text" style={{ width: '70px', height: '12px' }} />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flex: '0 0 100px' }}>
                <div className="skeleton-pill" style={{ width: '32px', height: '32px' }} />
                <div className="skeleton-pill" style={{ width: '32px', height: '32px' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
