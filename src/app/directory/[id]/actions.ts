'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface DetailedMemberProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  voice_part: string | null;
  join_date: string | null;
  phone: string | null;
  address: string | null;
  birthdate: string | null;
  is_phone_private: boolean;
  is_address_private: boolean;
  is_birthdate_private: boolean;
  avatar_url: string | null;
  cover_url: string | null;
  cover_position: string | null;
  interests: string[];
  created_at: string;
}

export interface PhotoItemServer {
  id: string;
  user_id: string;
  storage_path: string;
  created_at: string;
  publicUrl: string;
}

export async function getMemberProfileWithPhotos(targetUserId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    // Fetch currentUserProfile, targetProfile, and rawPhotos concurrently via Promise.all
    const [
      { data: currentUserProfile },
      { data: targetProfile, error: profileErr },
      { data: rawPhotos, error: photoErr },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single(),
      supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single(),
      supabase
        .from('profile_photos')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false }),
    ]);

    if (profileErr || !targetProfile) {
      return { error: 'Member profile not found.' };
    }

    const isCurrentAdmin = ['super_admin', 'director', 'secretary', 'treasurer'].includes(currentUserProfile?.role || '');
    const isOwner = user.id === targetUserId;

    // Mask private fields if viewer is not owner and not admin
    const maskedProfile: DetailedMemberProfile = {
      id: targetProfile.id,
      full_name: targetProfile.full_name,
      email: (isOwner || isCurrentAdmin) ? targetProfile.email : '',
      role: targetProfile.role,
      voice_part: targetProfile.voice_part,
      join_date: targetProfile.created_at,
      phone: (isOwner || isCurrentAdmin || !targetProfile.is_phone_private) ? targetProfile.phone : null,
      address: (isOwner || isCurrentAdmin || !targetProfile.is_address_private) ? targetProfile.address : null,
      birthdate: (isOwner || isCurrentAdmin || !targetProfile.is_birthdate_private) ? targetProfile.birthdate : null,
      is_phone_private: targetProfile.is_phone_private,
      is_address_private: targetProfile.is_address_private,
      is_birthdate_private: targetProfile.is_birthdate_private ?? true,
      avatar_url: targetProfile.avatar_url,
      cover_url: targetProfile.cover_url || null,
      cover_position: targetProfile.cover_position || '50%',
      interests: Array.isArray(targetProfile.interests) ? targetProfile.interests : [],
      created_at: targetProfile.created_at,
    };

    const photos: PhotoItemServer[] = (rawPhotos || []).map((p) => {
      const { data: { publicUrl } } = supabase.storage
        .from('profile_photos')
        .getPublicUrl(p.storage_path);
      return {
        ...p,
        publicUrl,
      };
    });

    return {
      profile: maskedProfile,
      photos,
      isOwner,
      isAdmin: isCurrentAdmin,
      currentUserId: user.id,
    };
  } catch (err: any) {
    console.error('getMemberProfileWithPhotos failed:', err);
    return { error: err.message || 'Server error' };
  }
}

export async function uploadProfilePhotoAction(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const file = formData.get('file') as File;
    if (!file) return { error: 'No file provided' };

    // Check count on DB to fail early
    const { count } = await supabase
      .from('profile_photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count || 0) >= 8) {
      return { error: 'Photo cap reached (maximum 8 photos per profile).' };
    }

    const fileExt = file.name ? file.name.split('.').pop() : 'jpeg';
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    // Convert Web File to Buffer for reliable Node.js server action upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use admin client for storage upload & db insert to avoid stream or RLS mismatch issues
    const adminSupabase = createAdminClient();

    const { error: uploadErr } = await adminSupabase.storage
      .from('profile_photos')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true
      });

    if (uploadErr) return { error: uploadErr.message };

    const { data: inserted, error: dbErr } = await adminSupabase
      .from('profile_photos')
      .insert({
        user_id: user.id,
        storage_path: filePath,
      })
      .select()
      .single();

    if (dbErr || !inserted) {
      await adminSupabase.storage.from('profile_photos').remove([filePath]);
      return { error: dbErr?.message || 'Database insert failed' };
    }

    const { data: { publicUrl } } = adminSupabase.storage
      .from('profile_photos')
      .getPublicUrl(filePath);

    return { success: true, photo: { ...inserted, publicUrl } };
  } catch (err: any) {
    console.error('uploadProfilePhotoAction error:', err);
    return { error: err.message || 'Upload failed' };
  }
}

export async function uploadCoverPhotoAction(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const file = formData.get('file') as File;
    if (!file) return { error: 'No cover image file provided' };

    const fileExt = file.name ? file.name.split('.').pop() : 'jpeg';
    const filePath = `covers/${user.id}_${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const adminSupabase = createAdminClient();

    const { error: uploadErr } = await adminSupabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true
      });

    if (uploadErr) return { error: uploadErr.message };

    const { data: { publicUrl } } = adminSupabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const { error: updateErr } = await adminSupabase
      .from('profiles')
      .update({ cover_url: publicUrl })
      .eq('id', user.id);

    if (updateErr) return { error: updateErr.message };

    return { success: true, coverUrl: publicUrl };
  } catch (err: any) {
    console.error('uploadCoverPhotoAction error:', err);
    return { error: err.message || 'Cover upload failed' };
  }
}

export async function updateInterestsAction(interests: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const adminSupabase = createAdminClient();
    const { error: updateErr } = await adminSupabase
      .from('profiles')
      .update({ interests })
      .eq('id', user.id);

    if (updateErr) return { error: updateErr.message };

    return { success: true };
  } catch (err: any) {
    console.error('updateInterestsAction error:', err);
    return { error: err.message || 'Failed to update interests' };
  }
}

export async function updateCoverPositionAction(coverPosition: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const adminSupabase = createAdminClient();
    const { error: updateErr } = await adminSupabase
      .from('profiles')
      .update({ cover_position: coverPosition })
      .eq('id', user.id);

    if (updateErr) return { error: updateErr.message };

    return { success: true };
  } catch (err: any) {
    console.error('updateCoverPositionAction error:', err);
    return { error: err.message || 'Failed to update cover position' };
  }
}

export async function deleteProfilePhotoAction(photoId: string, storagePath: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const adminSupabase = createAdminClient();

    // Delete record from DB
    const { data: deleted, error: dbErr } = await adminSupabase
      .from('profile_photos')
      .delete()
      .eq('id', photoId)
      .select();

    if (dbErr || !deleted || deleted.length === 0) {
      return { error: dbErr?.message || 'Failed to delete photo record.' };
    }

    // Delete file from storage
    await adminSupabase.storage.from('profile_photos').remove([storagePath]);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Delete failed' };
  }
}
