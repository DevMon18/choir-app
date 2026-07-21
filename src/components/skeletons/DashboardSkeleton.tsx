import React from 'react';

export const DashboardSkeleton = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner Skeleton */}
      <div
        className="glass-container"
        style={{
          height: '100px',
          borderRadius: '16px',
          background: 'rgba(11, 77, 36, 0.05)',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />

      {/* Grid Cards Skeleton */}
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
            className="glass-container"
            style={{
              height: '120px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.4)',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          />
        ))}
      </div>
    </div>
  );
};
