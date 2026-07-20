'use server';

import { createClient } from '@/lib/supabase/server';

export const submitJoinRequest = async (formData: FormData) => {
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const address = formData.get('address') as string;
  const contactNumber = formData.get('contactNumber') as string;
  const voicePart = formData.get('voicePart') as string;
  const choirExperience = formData.get('choirExperience') as string;
  const availability = formData.get('availability') as string;
  const reasonForJoining = formData.get('reasonForJoining') as string;

  if (!fullName || !email || !address || !contactNumber || !voicePart || !choirExperience || !availability || !reasonForJoining) {
    return { error: 'All fields are required' };
  }

  try {
    const supabase = await createClient();

    // Check if user already exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      if (['super_admin', 'director', 'treasurer', 'secretary', 'member'].includes(existingProfile.role)) {
        return { error: 'You are already a registered member of the choir.' };
      }
      if (existingProfile.role === 'pending') {
        return { error: 'You already have a pending registration request.' };
      }
    }

    // Insert new join request (if they were rejected, this allows them to resubmit via /join)
    const { error } = await supabase
      .from('join_requests')
      .insert([
        {
          full_name: fullName,
          email: email,
          address: address,
          contact_number: contactNumber,
          voice_part: voicePart,
          choir_experience: choirExperience,
          availability: availability,
          reason_for_joining: reasonForJoining,
          status: 'pending',
        },
      ]);

    if (error) {
      if (error.code === '23505') { // Unique violation on email
        // If a request is already pending, return message
        return { error: 'An application with this email address is already pending review.' };
      }
      return { error: error.message };
    }

    return { success: 'Your application has been received. Our directors will review it shortly!' };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};
