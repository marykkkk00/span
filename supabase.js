const SUPABASE_URL = "https://rtilajwtdtyhonytynai.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_copPiLsNBSGD_v2Lj1cfLQ_yqmWDwEs";

// В CDN v2 createClient обычно лежит в window.supabase
const { createClient } = window.supabase;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// положим в окно, чтобы inline-скрипт мог использовать
window.supabaseClient = supabaseClient;