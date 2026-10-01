(function () {
  "use strict";

  const IDENTITY_KEY = "monParcoursStudentIdentityV1";
  const DEVICE_KEY = "monParcoursDeviceIdV1";
  const providers = new Map();

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "local-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  function readStoredIdentity() {
    try {
      const value = JSON.parse(localStorage.getItem(IDENTITY_KEY));
      if (!value || typeof value.provider !== "string" || typeof value.subject !== "string") return null;
      return value;
    } catch (error) {
      return null;
    }
  }

  function localIdentity() {
    let deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) {
      deviceId = createId();
      localStorage.setItem(DEVICE_KEY, deviceId);
    }
    return {
      provider: "local",
      subject: deviceId,
      displayName: "Lokale leerling",
      className: "Alleen op dit toestel",
      verified: false
    };
  }

  function publicIdentity(identity) {
    return Object.freeze({
      provider: identity.provider,
      subject: identity.subject,
      displayName: identity.displayName || "Leerling",
      className: identity.className || "",
      verified: identity.verified === true,
      verifiedAt: identity.verifiedAt || null
    });
  }

  function getCurrentStudentIdentity() {
    return publicIdentity(readStoredIdentity() || localIdentity());
  }

  function registerProvider(name, provider) {
    if (!/^[a-z][a-z0-9_-]+$/.test(name) || !provider || typeof provider.connect !== "function") {
      throw new Error("INVALID_IDENTITY_PROVIDER");
    }
    providers.set(name, provider);
  }

  async function connect(providerName, credentials) {
    const provider = providers.get(providerName);
    if (!provider) throw new Error("UNKNOWN_IDENTITY_PROVIDER");
    const identity = await provider.connect(credentials || {});
    if (!identity || identity.provider !== providerName || !identity.subject) throw new Error("INVALID_IDENTITY_RESPONSE");
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    return publicIdentity(identity);
  }

  async function connectFromForm(providerName, form) {
    const provider = providers.get(providerName);
    if (!provider || typeof provider.readCredentials !== "function") throw new Error("UNSUPPORTED_IDENTITY_FORM");
    return connect(providerName, provider.readCredentials(form));
  }

  function switchToLocal() {
    localStorage.removeItem(IDENTITY_KEY);
    return getCurrentStudentIdentity();
  }

  function getSyncCredential() {
    const stored = readStoredIdentity();
    if (!stored) return null;
    const provider = providers.get(stored.provider);
    if (!provider || typeof provider.getSyncCredential !== "function") return null;
    return provider.getSyncCredential(stored);
  }

  function normalizeSchoolEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validSchoolEmail(value) {
    return /^[^@\s]+@camposturnhout\.be$/.test(normalizeSchoolEmail(value));
  }

  registerProvider("school_email", {
    readCredentials(form) {
      const data = new FormData(form);
      return { schoolEmail: data.get("school_email") };
    },
    async connect(credentials) {
      const schoolEmail = normalizeSchoolEmail(credentials.schoolEmail);
      if (!validSchoolEmail(schoolEmail)) throw new Error("INVALID_SCHOOL_EMAIL");
      if (!window.MonParcoursSupabase || !window.MonParcoursSupabase.isConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
      const raw = await window.MonParcoursSupabase.rpc("verify_student_email", {
        p_school_email: schoolEmail
      });
      const result = Array.isArray(raw) ? raw[0] : raw;
      if (!result || result.verified !== true || !result.identity || !result.identity.subject) {
        throw new Error("STUDENT_EMAIL_NOT_FOUND");
      }
      return {
        provider: "school_email",
        subject: result.identity.subject,
        displayName: result.identity.display_name || "Leerling",
        className: result.identity.class_name || "Klas",
        verified: true,
        verifiedAt: new Date().toISOString()
      };
    },
    getSyncCredential(identity) {
      return identity.subject;
    }
  });

  registerProvider("school_code", {
    readCredentials(form) {
      const data = new FormData(form);
      return { classCode: data.get("class_code"), studentCode: data.get("student_code") };
    },
    async connect(credentials) {
      const classCode = String(credentials.classCode || "").trim();
      const studentCode = String(credentials.studentCode || "").trim();
      if (classCode.length < 3 || classCode.length > 32 || studentCode.length < 8 || studentCode.length > 64) {
        throw new Error("INVALID_STUDENT_CODES");
      }
      if (!window.MonParcoursSupabase || !window.MonParcoursSupabase.isConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
      const raw = await window.MonParcoursSupabase.rpc("verify_student_identity", {
        p_class_code: classCode,
        p_student_code: studentCode
      });
      const result = Array.isArray(raw) ? raw[0] : raw;
      if (!result || result.verified !== true || !result.identity || !result.identity.subject) {
        throw new Error("STUDENT_NOT_FOUND");
      }
      return {
        provider: "school_code",
        subject: result.identity.subject,
        displayName: result.identity.display_name || "Leerling",
        className: result.identity.class_name || "Klas",
        verified: true,
        verifiedAt: new Date().toISOString()
      };
    },
    getSyncCredential(identity) {
      return identity.subject;
    }
  });

  window.StudentIdentity = Object.freeze({
    getCurrentStudentIdentity: getCurrentStudentIdentity,
    connect: connect,
    connectFromForm: connectFromForm,
    switchToLocal: switchToLocal,
    getSyncCredential: getSyncCredential,
    registerProvider: registerProvider,
    normalizeSchoolEmail: normalizeSchoolEmail,
    validSchoolEmail: validSchoolEmail,
    isRemoteAvailable: function () {
      return Boolean(window.MonParcoursSupabase && window.MonParcoursSupabase.isConfigured());
    }
  });
  window.getCurrentStudentIdentity = getCurrentStudentIdentity;
})();
