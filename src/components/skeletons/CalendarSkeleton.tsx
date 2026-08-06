import React from 'react';

export const CalendarSkeleton = () => {
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
      {/* Calendar Header Controls Skeleton */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton-text" style={{ width: '160px', height: '26px' }} />
          <div style={{ display: 'flex', gap: '4px' }}>
            <div className="skeleton-pill" style={{ width: '32px', height: '32px' }} />
            <div className="skeleton-pill" style={{ width: '32px', height: '32px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="skeleton-pill" style={{ width: '90px', height: '36px' }} />
          <div className="skeleton-pill" style={{ width: '130px', height: '36px' }} />
        </div>
      </div>

      {/* Days of week headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
          textAlign: 'center',
        }}
      >
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
          <div
            key={day}
            style={{
              padding: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--muted)',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Grid Skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
        }}
      >
        {Array.from({ length: 35 }).map((_, i) => {
          const hasEvent = i % 5 === 1 || i % 7 === 3 || i === 14 || i === 22;
          return (
            <div
              key={i}
              style={{
                height: '85px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.45)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div className="skeleton-text" style={{ width: '18px', height: '12px' }} />
              {hasEvent && (
                <div className="skeleton-pill" style={{ width: '100%', height: '20px' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
