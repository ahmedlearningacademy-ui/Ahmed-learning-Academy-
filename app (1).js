
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const configured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = (id) => document.getElementById(id);

$("year").textContent = new Date().getFullYear();

function show(message, target = "auth-message") {
  $(target).textContent = message;
}

function showPaymentForm(isSignedIn) {
  $("payment-form").hidden = !isSignedIn;
}

if (!supabase) {
  show("Setup required: connect Supabase before student login can work.");
} else {
  const { data } = await supabase.auth.getSession();
  showPaymentForm(!!data.session);

  supabase.auth.onAuthStateChange((_event, session) => {
    showPaymentForm(!!session);
  });
}

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    return show("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) return show(error.message);

  show(`Signed in successfully as ${data.user.email}.`);
  showPaymentForm(true);
});

$("signup").addEventListener("click", async () => {
  if (!supabase) return show("Supabase is not configured.");

  const { data, error } = await supabase.auth.signUp({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) return show(error.message);

  show(
    data.session
      ? "Account created. You are signed in."
      : "Account created. Check your email to confirm your account."
  );

  showPaymentForm(!!data.session);
});

$("payment-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) return show("Supabase is not configured.", "payment-message");

  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    show("Please sign in before uploading your receipt.", "payment-message");
    return showPaymentForm(false);
  }

  const file = $("receipt").files[0];

  if (!file) {
    return show("Please select your receipt.", "payment-message");
  }

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "application/pdf"
  ];

  if (!allowedTypes.includes(file.type)) {
    return show("Please upload a PNG, JPG or PDF file.", "payment-message");
  }

  if (file.size > 5 * 1024 * 1024) {
    return show("The receipt must be smaller than 5 MB.", "payment-message");
  }

  const user = userData.user;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${user.id}/${Date.now()}-${safeName}`;

  show("Uploading your receipt...", "payment-message");

  const { error: uploadError } = await supabase.storage
    .from("payment-receipts")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    return show(uploadError.message, "payment-message");
  }

  const { error: requestError } = await supabase
    .from("payment_requests")
    .insert({
      student_id: user.id,
      amount: 299,
      currency: "EGP",
      status: "pending",
      receipt_path: filePath
    });

  if (requestError) {
    await supabase.storage
      .from("payment-receipts")
      .remove([filePath]);

    return show(requestError.message, "payment-message");
  }

  $("payment-form").reset();
  show("Receipt uploaded successfully. Your payment is awaiting admin review.", "payment-message");
});
