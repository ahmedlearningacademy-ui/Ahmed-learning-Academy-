
/*
  AHMED LEARNING ACADEMY
  Phase 1 - Frontend application
  Supabase Auth + student interface foundation

  Requires config.js:
  export const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
  export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
*/

import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";

/* -----------------------------
   1. SUPABASE CONNECTION
----------------------------- */

const isConfigured =
  SUPABASE_URL?.startsWith("https://") &&
  SUPABASE_ANON_KEY?.length > 20 &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = (id) => document.getElementById(id);

const authForm = $("auth-form");
const emailInput = $("email");
const passwordInput = $("password");
const authMessage = $("auth-message");

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

/* -----------------------------
   2. MESSAGES
----------------------------- */

function message(text, target = "auth-message", type = "") {
  const element = $(target);
  if (!element) return;

  element.textContent = text;
  element.className = `message ${type}`;
}

function setLoading(button, loading, originalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading
    ? "Please wait..."
    : originalText;
}

function getCredentials() {
  const email = emailInput?.value.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    throw new Error("Enter your email and password.");
  }

  if (password.length < 6) {
    throw new Error("Password must contain at least 6 characters.");
  }

  return { email, password };
}

/* -----------------------------
   3. ACCOUNT REGISTRATION
----------------------------- */

$("signup")?.addEventListener("click", async () => {
  const button = $("signup");

  try {
    if (!supabase) {
      throw new Error("Connect Supabase in config.js first.");
    }

    const { email, password } = getCredentials();

    setLoading(button, true, "Create account");

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    if (data.session) {
      message("Account created successfully.", "auth-message", "success");
      await loadStudentSession(data.session);
    } else {
      message(
        "Account created. Check your email to confirm it.",
        "auth-message",
        "success"
      );
    }

  } catch (error) {
    message(error.message, "auth-message", "error");
  } finally {
    setLoading(button, false, "Create account");
  }
});

/* -----------------------------
   4. STUDENT SIGN IN
----------------------------- */

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = authForm.querySelector('[type="submit"]');

  try {
    if (!supabase) {
      throw new Error("Connect Supabase in config.js first.");
    }

    const { email, password } = getCredentials();

    setLoading(button, true, "Sign in");

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    message("Signed in successfully.", "auth-message", "success");

    await loadStudentSession(data.session);

  } catch (error) {
    message(error.message, "auth-message", "error");
  } finally {
    setLoading(button, false, "Sign in");
  }
});

/* -----------------------------
   5. STUDENT SESSION
----------------------------- */

async function loadStudentSession(session) {
  if (!session?.user) return;

  const user = session.user;

  console.info("Student authenticated:", user.id);

  message(
    `Welcome. Signed in as ${user.email}.`,
    "auth-message",
    "success"
  );

  /*
    Next integration:
    - Load student profile
    - Check subscription status
    - Load unlocked lessons
    - Load assignment results
    - Load portfolio and certificates
  */

  await loadStudentProfile(user.id);
}

async function loadStudentProfile(studentId) {
  if (!supabase) return;

  /*
    Expected future table:
    public.student_profiles

    Example columns:
    id, full_name, curriculum, academic_year
  */

  const { data, error } = await supabase
    .from("student_profiles")
    .select("id, full_name, curriculum, academic_year")
    .eq("id", studentId)
    .maybeSingle();

  if (error) {
    console.warn("Student profile is not configured yet:", error.message);
    return;
  }

  if (data) {
    console.info("Student profile loaded:", data);
  }
}

/* -----------------------------
   6. PAYMENT INFORMATION
----------------------------- */

$("payment-help")?.addEventListener("click", () => {
  message(
    "The monthly membership is EGP 299. Transfer using the official academy InstaPay details. Payment receipt submission will be enabled after the secure payment system is configured.",
    "payment-message"
  );
});

/*
  Payment workflow will use:
  payment_requests table
  private payment-receipts storage bucket

  Do not activate subscriptions from browser code.
  The server must verify payment and authorize activation.
*/

/* -----------------------------
   7. AUTH STATE
----------------------------- */

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
      console.info("Student signed in.");
    }

    if (event === "SIGNED_OUT") {
      message("You have signed out.");
    }

    if (event === "TOKEN_REFRESHED") {
      console.info("Session refreshed.");
    }
  });

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      message(error.message, "auth-message", "error");
      return;
    }

    if (data.session) {
      loadStudentSession(data.session);
    }
  });

} else {
  message(
    "Setup required: add your Supabase URL and public anon/publishable key in config.js.",
    "auth-message",
    "error"
  );
}

/* -----------------------------
   8. SIGN OUT FUNCTION
----------------------------- */

window.academySignOut = async function () {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    message(error.message, "auth-message", "error");
    return;
  }

  message("You have signed out successfully.", "auth-message", "success");
};

/* -----------------------------
   9. ACADEMY SETTINGS
----------------------------- */

window.ACADEMY = Object.freeze({
  name: "Ahmed Learning Academy",
  slogan: "Learning for life",
  monthlyPrice: 299,
  currency: "EGP",
  curricula: ["British", "American"],
  subjects: ["Mathematics", "Science", "English"],
  scienceSubjects: ["Physics", "Chemistry", "Biology"],
  passingScore: 80,
  paymentMethod: "InstaPay"
});

console.info("Ahmed Learning Academy Phase 1 initialized.");

