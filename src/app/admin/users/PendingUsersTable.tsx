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
      <div className="text-muted text-center py-10">
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
              <td data-label="Full Name"><strong>{user.full_name}</strong></td>
              <td data-label="Email">{user.email}</td>
              <td data-label="Status">
                {user.email_confirmed ? (
                  <span className="badge badge-approved">Email Confirmed</span>
                ) : (
                  <span className="badge badge-pending">Unconfirmed Email</span>
                )}
              </td>
              <td data-label="Request Date">{new Date(user.created_at).toLocaleDateString()}</td>
              <td data-label="Actions">
                <div className="flex gap-2.5">
                  {!user.email_confirmed ? (
                    <span className="text-xs sm:text-sm text-muted self-center">
                      Awaiting email confirmation
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => onUpdateRole(user.profile_id, 'member')}
                        className="btn btn-primary !py-1.5 !px-3 text-xs"
                        disabled={loadingId === user.profile_id}
                      >
                        {loadingId === user.profile_id ? 'Updating...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => onUpdateRole(user.profile_id, 'rejected')}
                        className="btn btn-secondary !py-1.5 !px-3 text-xs !border-error !text-error"
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
