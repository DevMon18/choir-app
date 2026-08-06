import React from 'react';

export const DashboardSkeleton = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1240px', margin: '0 auto', width: '100%' }}>
      {/* Hero Welcome Banner Skeleton */}
      <div
        className="skeleton-glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 28px',
          minHeight: '110px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton-circle" style={{ width: '56px', height: '56px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="skeleton-text" style={{ width: '220px', height: '22px' }} />
            <div className="skeleton-text" style={{ width: '140px', height: '14px' }} />
          </div>
        </div>
        <div className="skeleton-pill" style={{ width: '110px', height: '36px' }} />
      </div>

      {/* 4 Stat Cards Grid Skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px',
              height: '110px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton-text" style={{ width: '80px', height: '12px' }} />
              <div className="skeleton-text" style={{ width: '60px', height: '28px' }} />
            </div>
            <div className="skeleton-circle" style={{ width: '44px', height: '44px' }} />
          </div>
        ))}
      </div>

      {/* Content Columns Skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
        }}
      >
        <div className="skeleton-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '240px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton-text" style={{ width: '150px', height: '18px' }} />
            <div className="skeleton-pill" style={{ width: '70px', height: '24px' }} />
          </div>
          <div className="skeleton-box" style={{ height: '70px', width: '100%' }} />
          <div className="skeleton-box" style={{ height: '70px', width: '100%' }} />
        </div>

        <div className="skeleton-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '240px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton-text" style={{ width: '160px', height: '18px' }} />
            <div className="skeleton-pill" style={{ width: '70px', height: '24px' }} />
          </div>
          <div className="skeleton-box" style={{ height: '70px', width: '100%' }} />
          <div className="skeleton-box" style={{ height: '70px', width: '100%' }} />
        </div>
      </div>
    </div>
  );
};
