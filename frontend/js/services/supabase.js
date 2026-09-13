/**
 * @file supabase.js
 * @description Singleton del cliente Supabase para toda la aplicación.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jdauqeivzocdaanrjhbs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TBkwf10tQIiGa5_-TKEEfw_P6YPfXbp";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
