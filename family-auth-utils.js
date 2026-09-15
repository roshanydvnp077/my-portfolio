(function (global) {
  'use strict';

  function normalizeEmail(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function normalizeMemberPayload(payload) {
    const normalized = { ...(payload || {}) };
    delete normalized.password;
    delete normalized.confirmPassword;
    delete normalized.auth_user_id;
    delete normalized.user_id;
    if (typeof normalized.email === 'string') {
      normalized.email = normalizeEmail(normalized.email);
    }
    return normalized;
  }

  function buildDuplicateEmailError(email) {
    const normalized = normalizeEmail(email);
    const message = 'A family member with this email already exists.' + (normalized ? ' ' + normalized : '');
    const error = new Error(message);
    error.code = 'DUPLICATE_EMAIL';
    error.email = normalized || null;
    return error;
  }

  async function findLinkedFamilyMember(client, userId, email) {
    if (!client) return null;

    const candidateTables = ['family_members', 'family_details'];
    const normalizedEmail = normalizeEmail(email);

    if (userId) {
      for (const table of candidateTables) {
        try {
          const result = await client.from(table).select('*').eq('auth_user_id', userId).maybeSingle();
          if (!result.error && result.data) return { table, data: result.data };
        } catch (error) {
          console.warn('Family member lookup failed for table', table, error);
        }
      }
    }

    if (normalizedEmail) {
      for (const table of candidateTables) {
        try {
          const result = await client.from(table).select('*').eq('email', normalizedEmail).maybeSingle();
          if (!result.error && result.data) return { table, data: result.data };
        } catch (error) {
          console.warn('Family member fallback lookup failed for table', table, error);
        }
      }
    }

    return null;
  }

  const api = {
    normalizeEmail,
    normalizeMemberPayload,
    buildDuplicateEmailError,
    findLinkedFamilyMember
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.FamilyAuthUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
