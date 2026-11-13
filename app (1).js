
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

function setSignedIn(isSignedIn) {
  $("payment-form").hidden = !isSignedIn;
  $("signout").hidden = !isSignedIn;
}

async function loadAdminDashboard(user) {
  $("admin-dashboard").hidden = true;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || profile?.role !== "admin") return;

  $("admin-dashboard").hidden = false;
  await loadPaymentRequests();
}

async function updateSession(session) {
  const signedIn = !!session?.user;
  setSignedIn(signedIn);
  $("admin-dashboard").hidden = true;

  if (signedIn) {
    await loadAdminDashboard(session.user);
  }
}

async function loadPaymentRequests() {
  const list = $("payment-requests-list");
  list.replaceChildren();
  show("Loading payment requests...", "admin-message");

  const { data: requests, error } = await supabase
    .from("payment_requests")
    .select("id, student_id, amount, currency, status, receipt_path, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return show(error.message, "admin-message");
  }

  if (!requests || requests.length === 0) {
    return show("There are no payment requests yet.", "admin-message");
  }

  show(`${requests.length} payment request(s) found.`, "admin-message");

  for (const request of requests) {
    const card = document.createElement("article");
    card.className = "subject";

    const heading = document.createElement("h3");
    heading.textContent = `Payment: ${request.amount} ${request.currency}`;

    const student = document.createElement("p");
    student.textContent = `Student ID: ${request.student_id}`;

    const status = document.createElement("p");
    status.textContent = `Status: ${request.status}`;

    const date = document.createElement("p");
    date.textContent = `Submitted: ${new Date(request.created_at).toLocaleString()}`;

    card.append(heading, student, status, date);

    if (request.receipt_path) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from("payment-receipts")
        .createSignedUrl(request.receipt_path, 600);

      if (!fileError && fileData?.signedUrl) {
        const receiptLink = document.createElement("a");
        receiptLink.href = fileData.signedUrl;
        receiptLink.target = "_blank";
        receiptLink.rel = "noopener noreferrer";
        receiptLink.textContent = "View payment receipt";
        card.append(receiptLink);
      } else {
        const receiptError = document.createElement("p");
        receiptError.textContent = "Receipt could not be opened.";
        card.append(receiptError);
      }
    }

    if (request.status === "pending") {
      const actions = document.createElement("div");
      actions.className = "actions";

      const approve = document.createElement("button");
      approve.className = "primary";
      approve.type = "button";
      approve.textContent = "Approve";

      approve.addEventListener("click", () =>
        reviewPayment(request.id, "approved")
      );

      const reject = document.createElement("button");
      reject.className = "secondary";
      reject.type = "button";
      reject.textContent = "Reject";

      reject.addEventListener("click", () =>
        reviewPayment(request.id, "rejected")
      );

      actions.append(approve, reject);
      card.append(actions);
    }

    list.append(card);
  }
}

async function reviewPayment(paymentRequestId, action) {
  const confirmed = window.confirm(
    action === "approved"
      ? "Approve this payment and activate 30 days of access?"
      : "Reject this payment request?"
  );

  if (!confirmed) return;

  show("Updating payment request...", "admin-message");

  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    return show("Please sign in again.", "admin-message");
  }

  const { error } = await supabase.rpc("admin_review_payment", {
    p_payment_request_id: paymentRequestId,
    p_action: action,
    p_admin_id: userData.user.id
  });

  if (error) {
    return show(error.message, "admin-message");
  }

  show(
    action === "approved"
      ? "Payment approved. Subscription activated."
      : "Payment request rejected.",
    "admin-message"
  );

  await loadPaymentRequests();
}

if (!supabase) {
  show("Setup required: connect Supabase before student login can work.");
} else {
  const { data } = await supabase.auth.getSession();
  await updateSession(data.session);

  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => updateSession(session), 0);
  });
}

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) return show("Supabase is not configured.");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) return show(error.message);

  show(`Signed in successfully as ${data.user.email}.`);
  await updateSession(data.session);
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

  await updateSession(data.session);
});

$("signout").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) return show(error.message);

  setSignedIn(false);
  $("admin-dashboard").hidden = true;
  show("You have signed out.");
});

$("payment-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    return show("Supabase is not configured.", "payment-message");
  }

  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    show("Please sign in before uploading your receipt.", "payment-message");
    return setSignedIn(false);
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

  show(
    "Receipt uploaded successfully. Your payment is awaiting admin review.",
    "payment-message"
  );
});

$("refresh-requests").addEventListener("click", loadPaymentRequests);

