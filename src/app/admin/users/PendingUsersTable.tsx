'use client';

import React from 'react';

interface PendingUser {
  profile_id: string;
  full_name: string;
  email: string;
  email_confirmed: boolean;
  created_at: string;
}

interface PendingUsersTableProps {
  pendingUsers: PendingUser[];
  loadingId: string | null;
  onUpdateRole: (userId: string, newRole: string) => void;
}

export const PendingUsersTable = ({
  pendingUsers,
  loadingId,
  onUpdateRole,
}: PendingUsersTableProps) => {
  if (pendingUsers.length === 0) {
    return (
      <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
        No pending signups found. All caught up!
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Request Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pendingUsers.map((user) => (
            <tr key={user.profile_id}>
              <td><strong>{user.full_name}</strong></td>
              <td>{user.email}</td>
              <td>
                {user.email_confirmed ? (
                  <span className="badge badge-approved">Email Confirmed</span>
                ) : (
                  <span className="badge badge-pending">Unconfirmed Email</span>
                )}
              </td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {!user.email_confirmed ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)', alignSelf: 'center' }}>
                      Awaiting email confirmation
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => onUpdateRole(user.profile_id, 'member')}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        disabled={loadingId === user.profile_id}
                      >
                        {loadingId === user.profile_id ? 'Updating...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => onUpdateRole(user.profile_id, 'rejected')}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'var(--error)', color: 'var(--error)' }}
                        disabled={loadingId === user.profile_id}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
