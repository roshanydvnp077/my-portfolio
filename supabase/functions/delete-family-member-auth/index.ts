import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400'
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const authUserId = String(body?.auth_user_id || '').trim()

    if (!authUserId) {
      return jsonResponse({ success: false, error: 'auth_user_id is required.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ success: false, error: 'Server-side auth service is not configured.' }, 500)
    }

    const authHeader = req.headers.get('authorization') || ''
    const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!authToken) {
      return jsonResponse({ success: false, error: 'Unauthorized: missing admin session.' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })

    const { data: userData, error: userError } = await admin.auth.getUser(authToken)
    if (userError || !userData.user) {
      return jsonResponse({ success: false, error: 'Unauthorized: invalid admin session.' }, 401)
    }

    const { data: adminMatch, error: adminError } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (adminError || !adminMatch) {
      return jsonResponse({ success: false, error: 'Admin access required.' }, 403)
    }

    const { error } = await admin.auth.admin.deleteUser(authUserId)

    if (error) {
      return jsonResponse({ success: false, error: error.message || 'Failed to delete auth user.' }, 400)
    }

    return jsonResponse({ success: true, auth_user_id: authUserId }, 200)
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Cleanup failed.' }, 500)
  }
})
