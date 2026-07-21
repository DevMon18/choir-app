import React from 'react';

export const CalendarSkeleton = () => {
  return (
    <div className="glass-container" style={{ padding: '24px', borderRadius: '16px' }}>
      {/* Calendar Header Skeleton */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            width: '160px',
            height: '28px',
            borderRadius: '6px',
            background: 'rgba(11, 77, 36, 0.08)',
            animation: 'pulse 1.5s infinite ease-in-out',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{
              width: '80px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(11, 77, 36, 0.08)',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          />
          <div
            style={{
              width: '80px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(11, 77, 36, 0.08)',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          />
        </div>
      </div>

      {/* Month Grid Skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
        }}
      >
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: '70px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.35)',
              border: '1px solid rgba(11, 77, 36, 0.05)',
              padding: '8px',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          />
        ))}
      </div>
    </div>
  );
};
