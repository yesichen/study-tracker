import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 替换为你的 Project URL 和 anon key
const SUPABASE_URL = 'https://trkwfkuvdhnxxvlccvse.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3KCtTOAjqIAmrZkvQ1NdEw_pjciN_AW';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);