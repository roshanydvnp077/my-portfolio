// Supabase Edge Function: create-family-member-auth
// Creates a Supabase Auth user and links it to a family member
// Requires admin authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateAuthRequest {
  email: string
  password: string
  member_data: {
    full_name: string
    relation?: string
    gender?: string
    date_of_birth?: string
    phone?: string
    address?: string
    occupation?: string
    blood_group?: string
    notes?: string
    created_by: string
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '').trim()

    // Create Supabase client with the user's token (for admin check)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Client with anon key (for database operations with user context)
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Service client (for creating auth users)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the user is authenticated by validating the JWT token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      console.error('User authentication failed:', userError)
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: Invalid or expired token',
          details: userError?.message || 'Could not verify user authentication'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.id, user.email)

    // Verify the user is an admin
    const { data: adminData, error: adminError } = await supabaseClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (adminError) {
      console.error('Admin check error:', adminError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to verify admin status',
          details: adminError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!adminData) {
      console.log('User is not an admin:', user.id, user.email)
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden: Admin access required',
          details: 'Your account does not have permission to create family members. Contact the system administrator.'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Admin verified:', user.id)

    // Parse request body
    const requestData: CreateAuthRequest = await req.json()
    const { email, password, member_data } = requestData

    // Validate required fields
    if (!email || !password || !member_data?.full_name) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: email, password, and member_data.full_name are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase()

    // Check if email already exists in family_members
    const { data: existingMember, error: checkError } = await supabaseClient
      .from('family_members')
      .select('id, email, full_name')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing member:', checkError)
    }

    if (existingMember) {
      return new Response(
        JSON.stringify({ 
          error: `A family member with email "${normalizedEmail}" already exists.`,
          existing_member: existingMember
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create auth user with admin privileges
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: member_data.full_name,
        role: 'family_member',
        created_by_admin: user.id,
      }
    })

    if (authError) {
      console.error('Auth user creation error:', authError)
      return new Response(
        JSON.stringify({ 
          error: `Failed to create auth user: ${authError.message}`,
          details: authError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!authUser.user) {
      return new Response(
        JSON.stringify({ error: 'Auth user creation returned no user data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create family member record with auth_user_id
    const familyMemberData = {
      full_name: member_data.full_name,
      email: normalizedEmail,
      auth_user_id: authUser.user.id,
      account_status: 'active',
      relation: member_data.relation || null,
      gender: member_data.gender || null,
      date_of_birth: member_data.date_of_birth || null,
      phone: member_data.phone || null,
      address: member_data.address || null,
      occupation: member_data.occupation || null,
      blood_group: member_data.blood_group || null,
      notes: member_data.notes || null,
    }

    const { data: familyMember, error: memberError } = await supabaseClient
      .from('family_members')
      .insert([familyMemberData])
      .select()
      .single()

    if (memberError) {
      console.error('Family member creation error:', memberError)
      
      // Rollback: Delete the auth user we just created
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to create family member record: ${memberError.message}`,
          details: memberError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Success!
    return new Response(
      JSON.stringify({
        success: true,
        auth_user_id: authUser.user.id,
        family_member: familyMember,
        message: 'Family member and auth account created successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
