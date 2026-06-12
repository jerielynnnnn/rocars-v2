import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const BUCKET_NAME = 'refund-proofs'
const MAX_FILE_SIZE = 25 * 1024 * 1024

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null

  if (!token) {
    return { error: 'No token provided', status: 401 as const }
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { error: 'Invalid token', status: 401 as const }
  }

  return { user }
}

async function ensureProofBucket() {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()

  if (listError) {
    throw listError
  }

  if (buckets?.some((bucket) => bucket.name === BUCKET_NAME)) {
    return
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: ['image/*', 'video/*'],
  })

  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw createError
  }
}

export async function POST(request: NextRequest) {
  const auth = await getUserFromRequest(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const orderId = Number(formData.get('orderId'))

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Proof file is required' }, { status: 400 })
    }

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Only photo or video proof files are allowed' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Proof file must be 25MB or smaller' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .eq('user_id', auth.user.id)
      .eq('order_status', 'delivered')
      .maybeSingle()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Delivered order not found' }, { status: 404 })
    }

    await ensureProofBucket()

    const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin'
    const filePath = `${auth.user.id}/${orderId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    return NextResponse.json({
      proof: {
        url: publicUrl,
        type: file.type,
        name: file.name,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload proof'
    console.error('Refund proof upload failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
