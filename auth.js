

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Config ──────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBf6eSDrjZfU7ryJwg9FZiYO5EFhonmZdU",
  authDomain: "shaart-99f91.firebaseapp.com",
  projectId: "shaart-99f91",
  storageBucket: "shaart-99f91.firebasestorage.app",
  messagingSenderId: "91622467831",
  appId: "1:91622467831:web:faa7b7418583e162be0bf2",
  measurementId: "G-D0R7J456BT",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
import { enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Offline persistence unavailable:", err.code);
});

const googleProvider = new GoogleAuthProvider();

// ── Wishlist helpers ─────────────────────────────────────────
async function getWishlist(uid) {
  const ref = doc(db, "wishlists", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().items || [] : [];
}

async function addToWishlist(uid, artworkId) {
  const ref = doc(db, "wishlists", uid);
  await setDoc(ref, { items: arrayUnion(artworkId) }, { merge: true });
}

async function removeFromWishlist(uid, artworkId) {
  const ref = doc(db, "wishlists", uid);
  await updateDoc(ref, { items: arrayRemove(artworkId) });
}

// ── Nav rendering ────────────────────────────────────────────
function renderUserNav(user) {
  const nav = document.getElementById("auth-nav");
  if (!nav) return;
  const initials = (user.displayName || user.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  nav.innerHTML = `
  <div class="nav-user">
    <div class="nav-user-avatar" title="${user.displayName || user.email}">
      ${user.photoURL
        ? `<img src="${user.photoURL}" alt="avatar" style="width:36px;height:36px;border-radius:50%;object-fit:cover"/>`
        : `<div class="avatar" style="width:36px;height:36px">${initials}</div>`}
    </div>
    <span class="nav-name">${user.displayName?.split(" ")[0] || "You"}</span>
    <button class="btn-outline" style="padding:6px 14px;font-size:12px" onclick="window.openWishlist()">♡ Wishlist</button>
    <button class="btn-signout" id="btn-signout">Sign out</button>
  </div>`;
  document.getElementById("btn-signout").onclick = () => signOut(auth);
}

function renderGuestNav() {
  const nav = document.getElementById("auth-nav");
  if (!nav) return;
  nav.innerHTML = `<button class="btn-login" id="btn-open-modal">Login / Sign up</button>`;
  document.getElementById("btn-open-modal").onclick = openModal;
}

// ── Modal ────────────────────────────────────────────────────
function openModal() {
  document.getElementById("auth-modal").classList.add("open");
}
function closeModal() {
  document.getElementById("auth-modal").classList.remove("open");
  clearError();
}

function showError(msg) {
  const el = document.getElementById("auth-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}
function clearError() {
  const el = document.getElementById("auth-error");
  if (el) { el.textContent = ""; el.style.display = "none"; }
}

// ── Wire up modal buttons (called after DOM ready) ───────────
function bindModal() {
  // Tab toggle
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const mode = tab.dataset.mode;
      document.getElementById("auth-submit").textContent =
        mode === "login" ? "Log in" : "Create account";
      document.getElementById("auth-name-row").style.display =
        mode === "signup" ? "block" : "none";
      clearError();
    };
  });

  // Submit
  document.getElementById("auth-submit").onclick = async () => {
    const mode = document.querySelector(".auth-tab.active").dataset.mode;
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const name = document.getElementById("auth-name").value.trim();
    clearError();
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
      }
      closeModal();
    } catch (e) {
      showError(friendlyError(e.code));
    }
  };

  // Google
  document.getElementById("btn-google").onclick = async () => {
    clearError();
    try {
      await signInWithPopup(auth, googleProvider);
      closeModal();
    } catch (e) {
      showError(friendlyError(e.code));
    }
  };

  // Close
  document.getElementById("modal-close").onclick = closeModal;
  document.getElementById("auth-modal").onclick = (e) => {
    if (e.target === e.currentTarget) closeModal();
  };
}

function friendlyError(code) {
  const map = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password — try again.",
    "auth/email-already-in-use": "That email is already registered. Try logging in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/network-request-failed": "Network error — check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

window.toggleWishlist = async function(artworkId) {
  const user = auth.currentUser;
  if(!user) { openModal(); return; }
  
  const list = window.__shaartWishlist || [];
  const isWishlisted = list.includes(artworkId);

  // Update UI instantly — don't wait for Firebase
  if(isWishlisted) {
    window.__shaartWishlist = list.filter(id => id !== artworkId);
    if(window.showToast) showToast('Removed from wishlist');
  } else {
    window.__shaartWishlist = [...list, artworkId];
    if(window.showToast) showToast('Added to wishlist ♡');
  }
  refreshWishlistUI(window.__shaartWishlist);

  // Sync to Firebase in background
  try {
    if(isWishlisted) {
      await removeFromWishlist(user.uid, artworkId);
    } else {
      await addToWishlist(user.uid, artworkId);
    }
  } catch(e) {
    console.warn('Wishlist sync failed:', e.message);
  }
};
// ── Update heart icons on your cards ────────────────────────
function refreshWishlistUI(wishlist) {
  const count = document.getElementById('wishlistCount');
  if(count) count.textContent = wishlist.length;
  document.querySelectorAll('[data-artwork-id]').forEach(el => {
    const isWishlisted = wishlist.includes(Number(el.dataset.artworkId));
    el.classList.toggle('active', isWishlisted);
    el.textContent = isWishlisted ? '♥' : '♡';  
  });
}

let authReady = false;

document.addEventListener("DOMContentLoaded", () => {
  renderGuestNav(); // show login immediately
  bindModal();
});


onAuthStateChanged(auth, async (user) => {
  authReady = true;

  if (user) {
    let wishlist = [];
    try {
      wishlist = await getWishlist(user.uid);
    } catch (e) {}

    window.__shaartWishlist = wishlist;
    renderUserNav(user);
    refreshWishlistUI(wishlist);
  } else {
    window.__shaartWishlist = [];
    renderGuestNav();
    refreshWishlistUI([]);
  }
});