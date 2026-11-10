// Ahmed Learning Academy - initial Cloudflare Pages frontend.
// Add your Supabase project URL and anon/publishable key in config.js before enabling login.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const configured = SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);
$("year").textContent = new Date().getFullYear();

function show(message, target = "auth-message") {
  $(target).textContent = message;
}

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) {
    show("Supabase is not configured yet. Add your project URL and anon key in config.js.");
    return;
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });
  if (error) return show(error.message);
  show(`Signed in successfully${data.user?.email ? ` as ${data.user.email}` : ""}.`);
});

$("signup").addEventListener("click", async () => {
  if (!supabase) return show("Supabase is not configured yet. Add your project URL and anon key in config.js.");
  const { data, error } = await supabase.auth.signUp({
    email: $("email").value.trim(),
    password: $("password").value
  });
  if (error) return show(error.message);
  show(data.session ? "Account created. You are signed in." : "Account created. Check your email to confirm your account.");
});

$("payment-help").addEventListener("click", () => {
  show("Transfer EGP 299 using the academy's official InstaPay details. Then sign in and submit your receipt. Payment submission and admin review will be enabled after the database settings are confirmed.", "payment-message");
});

if (!configured) {
  show("Setup required: connect Supabase before student login can work.");
}
