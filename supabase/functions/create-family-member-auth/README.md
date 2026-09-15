# Create Family Member Auth - Edge Function

## Purpose
Automatically creates Supabase Auth users for family members when added by admin.

## Features
- ✅ Admin authentication required
- ✅ Validates email uniqueness
- ✅ Creates auth user with auto-confirmed email
- ✅ Links auth user to family member record
- ✅ Rollback on failure (deletes auth user if member creation fails)
- ✅ Returns complete member data

## Deployment

### Prerequisites
1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref YOUR_PROJECT_REF`

### Deploy Command
```bash
supabase functions deploy create-family-member-auth
```

### Set Environment Variables
The function needs these environment variables (automatically available in Supabase):
- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for creating auth users)

## Usage

### Request
```javascript
const response = await supabaseClient.functions.invoke('create-family-member-auth', {
  body: {
    email: 'member@example.com',
    password: 'securePassword123',
    member_data: {
      full_name: 'John Doe',
      relation: 'Brother',
      gender: 'Male',
      date_of_birth: '1990-01-01',
      phone: '+1234567890',
      address: '123 Main St',
      occupation: 'Engineer',
      blood_group: 'O+',
      notes: 'Additional notes',
      created_by: 'admin-user-id'
    }
  }
})
```

### Success Response (200)
```json
{
  "success": true,
  "auth_user_id": "uuid-of-auth-user",
  "family_member": {
    "id": "uuid-of-family-member",
    "full_name": "John Doe",
    "email": "member@example.com",
    "auth_user_id": "uuid-of-auth-user",
    "account_status": "active",
    ...
  },
  "message": "Family member and auth account created successfully"
}
```

### Error Responses

**401 Unauthorized**
```json
{
  "error": "Missing authorization header"
}
```

**403 Forbidden**
```json
{
  "error": "Forbidden: Admin access required"
}
```

**409 Conflict**
```json
{
  "error": "A family member with email \"member@example.com\" already exists.",
  "existing_member": { ... }
}
```

**500 Internal Error**
```json
{
  "error": "Failed to create auth user: <error message>",
  "details": { ... }
}
```

## Security
- ✅ Requires valid admin authentication
- ✅ Uses service role key securely (server-side only)
- ✅ Validates all inputs
- ✅ Prevents duplicate emails
- ✅ Auto-confirms email (admin-created accounts)
- ✅ Atomic operations (rollback on failure)

## Testing

### Test with curl
```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-family-member-auth' \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testPassword123",
    "member_data": {
      "full_name": "Test User",
      "relation": "Cousin",
      "created_by": "admin-id"
    }
  }'
```

### Test from Browser Console
```javascript
const { data, error } = await supabaseClient.functions.invoke('create-family-member-auth', {
  body: {
    email: 'test@example.com',
    password: 'testPassword123',
    member_data: {
      full_name: 'Test User',
      relation: 'Cousin',
      created_by: 'admin-id'
    }
  }
})

console.log('Result:', data, error)
```

## Local Development

### Run locally
```bash
supabase functions serve create-family-member-auth
```

### Test locally
```bash
curl -X POST 'http://localhost:54321/functions/v1/create-family-member-auth' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

## Maintenance

### View logs
```bash
supabase functions logs create-family-member-auth
```

### Update function
1. Edit `index.ts`
2. Run: `supabase functions deploy create-family-member-auth`

## Troubleshooting

### "Service role key not found"
Ensure your project has the service role key set. Check in Supabase Dashboard → Settings → API.

### "Admin access required"
The calling user must exist in the `admin_users` table.

### "Email already exists"
Check `family_members` table for existing email. Use a different email or update the existing member.

### "Failed to create auth user"
Check Supabase Auth settings. Ensure:
- Email provider is enabled
- No conflicting auth policies
- Service role key is valid
