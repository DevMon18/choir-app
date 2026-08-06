import React from 'react';

export const RepertoireSkeleton = () => {
  return (
    <div
      style={{
        padding: '24px 16px 120px',
        maxWidth: '1240px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Repertoire Header Banner Skeleton */}
      <div
        className="skeleton-glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="skeleton-text" style={{ width: '220px', height: '26px' }} />
          <div className="skeleton-text" style={{ width: '160px', height: '14px' }} />
        </div>
        <div className="skeleton-pill" style={{ width: '130px', height: '38px' }} />
      </div>

      {/* Search & Category Filter Pills Skeleton */}
      <div
        className="skeleton-glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          flexWrap: 'wrap',
        }}
      >
        <div className="skeleton-pill" style={{ width: '240px', height: '40px' }} />
        <div style={{ display: 'flex', gap: '8px', overflowX: 'hidden' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-pill" style={{ width: '90px', height: '32px' }} />
          ))}
        </div>
      </div>

      {/* 3x3 Song Cards Grid Skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-glass-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
              padding: '20px',
              minHeight: '150px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '75%' }}>
                <div className="skeleton-text" style={{ width: '90%', height: '18px' }} />
                <div className="skeleton-text" style={{ width: '55%', height: '12px' }} />
              </div>
              <div className="skeleton-circle" style={{ width: '32px', height: '32px' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
              <div className="skeleton-pill" style={{ width: '75px', height: '22px' }} />
              <div className="skeleton-pill" style={{ width: '85px', height: '28px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
