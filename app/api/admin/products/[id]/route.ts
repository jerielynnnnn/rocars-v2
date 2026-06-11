import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminLikeRole } from '@/lib/admin-role'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function requireProductStaff(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null

  if (!token) {
    return { error: 'No token provided', status: 401 as const }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)

  if (userError || !user) {
    return { error: 'Invalid token', status: 401 as const }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !isAdminLikeRole(profile?.role)) {
    return { error: 'Admin or staff access required', status: 403 as const }
  }

  return { user, token }
}

function createUserScopedClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProductStaff(request)

    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await context.params
    const body = await request.json()
    const updateData = body.product || body

    if (updateData.slug) {
      const { data: existingProduct, error: slugError } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('slug', updateData.slug)
        .neq('id', id)
        .maybeSingle()

      if (slugError) {
        return NextResponse.json({ error: slugError.message, details: slugError }, { status: 500 })
      }

      if (existingProduct) {
        return NextResponse.json(
          { error: 'A product with this name already exists (duplicate slug)' },
          { status: 409 }
        )
      }
    }

    let { data, error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error && /admin_id|null value|admin_logs/i.test(error.message)) {
      const userScopedSupabase = createUserScopedClient(auth.token)
      const retry = await userScopedSupabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      data = retry.data
      error = retry.error

      if (error && /admin_notifications|permission denied/i.test(error.message)) {
        return NextResponse.json(
          {
            error:
              'Product update trigger cannot write admin notifications. Run supabase/sql/fix-admin-product-update-notifications.sql in Supabase SQL editor.',
            details: error,
          },
          { status: 500 }
        )
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    return NextResponse.json({ product: data })
  } catch (error) {
    console.error('Admin product update API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProductStaff(request)

    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await context.params

    let { error: imagesError } = await supabaseAdmin
      .from('product_images')
      .delete()
      .eq('product_id', id)

    if (imagesError && /admin_id|null value|admin_logs/i.test(imagesError.message)) {
      const userScopedSupabase = createUserScopedClient(auth.token)
      const retry = await userScopedSupabase
        .from('product_images')
        .delete()
        .eq('product_id', id)

      imagesError = retry.error

      if (imagesError && /admin_notifications|permission denied/i.test(imagesError.message)) {
        return NextResponse.json(
          {
            error:
              'Product image delete trigger cannot write admin notifications. Run supabase/sql/fix-admin-product-update-notifications.sql in Supabase SQL editor.',
            details: imagesError,
          },
          { status: 500 }
        )
      }
    }

    if (imagesError) {
      return NextResponse.json({ error: imagesError.message, details: imagesError }, { status: 500 })
    }

    let { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id)

    if (error && /admin_id|null value|admin_logs/i.test(error.message)) {
      const userScopedSupabase = createUserScopedClient(auth.token)
      const retry = await userScopedSupabase
        .from('products')
        .delete()
        .eq('id', id)

      error = retry.error

      if (error && /admin_notifications|permission denied/i.test(error.message)) {
        return NextResponse.json(
          {
            error:
              'Product delete trigger cannot write admin notifications. Run supabase/sql/fix-admin-product-update-notifications.sql in Supabase SQL editor.',
            details: error,
          },
          { status: 500 }
        )
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin product delete API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete product' },
      { status: 500 }
    )
  }
}
