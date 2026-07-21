import React from 'react';

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => {
  return (
    <div className="glass-container" style={{ padding: '20px', borderRadius: '16px' }}>
      {/* Header Skeleton */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            width: '180px',
            height: '24px',
            borderRadius: '6px',
            background: 'rgba(11, 77, 36, 0.08)',
            animation: 'pulse 1.5s infinite ease-in-out',
          }}
        />
        <div
          style={{
            width: '120px',
            height: '36px',
            borderRadius: '8px',
            background: 'rgba(11, 77, 36, 0.08)',
            animation: 'pulse 1.5s infinite ease-in-out',
          }}
        />
      </div>

      {/* Table Rows Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid rgba(11, 77, 36, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '40%' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(11, 77, 36, 0.1)',
                  animation: 'pulse 1.5s infinite ease-in-out',
                }}
              />
              <div
                style={{
                  width: '70%',
                  height: '16px',
                  borderRadius: '4px',
                  background: 'rgba(11, 77, 36, 0.08)',
                  animation: 'pulse 1.5s infinite ease-in-out',
                }}
              />
            </div>
            <div
              style={{
                width: '20%',
                height: '16px',
                borderRadius: '4px',
                background: 'rgba(11, 77, 36, 0.08)',
                animation: 'pulse 1.5s infinite ease-in-out',
              }}
            />
            <div
              style={{
                width: '15%',
                height: '24px',
                borderRadius: '12px',
                background: 'rgba(197, 160, 89, 0.15)',
                animation: 'pulse 1.5s infinite ease-in-out',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
