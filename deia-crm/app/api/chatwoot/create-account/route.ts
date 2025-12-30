import { NextRequest, NextResponse } from 'next/server'

const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL || process.env.CHATWOOT_PLATFORM_URL
const CHATWOOT_PLATFORM_TOKEN = process.env.CHATWOOT_PLATFORM_TOKEN

/**
 * POST /api/chatwoot/create-account
 *
 * Cria uma nova Account e Admin User no Chatwoot
 * Chamado durante o signup de uma nova empresa
 *
 * Input: { accountName, userEmail, userName }
 * Output: { success, chatwoot_account_id, chatwoot_api_key }
 */
export async function POST(request: NextRequest) {
  try {
    if (!CHATWOOT_API_URL || !CHATWOOT_PLATFORM_TOKEN) {
      console.error('[Chatwoot Create Account] Missing environment variables')
      return NextResponse.json(
        { success: false, error: 'Chatwoot Platform API not configured' },
        { status: 500 }
      )
    }

    const { accountName, userEmail, userName } = await request.json()

    if (!accountName || !userEmail || !userName) {
      return NextResponse.json(
        { success: false, error: 'accountName, userEmail and userName are required' },
        { status: 400 }
      )
    }

    console.log(`[Chatwoot Create Account] Creating account for: ${accountName}`)

    // Step 1: Create Account in Chatwoot
    const accountResponse = await fetch(`${CHATWOOT_API_URL}/platform/api/v1/accounts`, {
      method: 'POST',
      headers: {
        'api_access_token': CHATWOOT_PLATFORM_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: accountName
      })
    })

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text()
      console.error(`[Chatwoot Create Account] Failed to create account:`, errorText)
      return NextResponse.json(
        { success: false, error: `Failed to create Chatwoot account: ${accountResponse.status}` },
        { status: 500 }
      )
    }

    const accountData = await accountResponse.json()
    const accountId = accountData.id

    console.log(`[Chatwoot Create Account] Account created with ID: ${accountId}`)

    // Step 2: Create Admin User for this account
    const userResponse = await fetch(
      `${CHATWOOT_API_URL}/platform/api/v1/accounts/${accountId}/account_users`,
      {
        method: 'POST',
        headers: {
          'api_access_token': CHATWOOT_PLATFORM_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: null, // Will create new user
          name: userName,
          email: userEmail,
          role: 'administrator'
        })
      }
    )

    let apiKey = null

    if (userResponse.ok) {
      const userData = await userResponse.json()
      apiKey = userData.access_token
      console.log(`[Chatwoot Create Account] Admin user created for account ${accountId}`)
    } else {
      // Try alternative approach - create user first, then add to account
      console.log(`[Chatwoot Create Account] Trying alternative user creation approach...`)

      // Create user via platform API
      const createUserResponse = await fetch(`${CHATWOOT_API_URL}/platform/api/v1/users`, {
        method: 'POST',
        headers: {
          'api_access_token': CHATWOOT_PLATFORM_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          password: generateRandomPassword(),
          custom_attributes: {}
        })
      })

      if (createUserResponse.ok) {
        const newUser = await createUserResponse.json()

        // Add user to account
        const addToAccountResponse = await fetch(
          `${CHATWOOT_API_URL}/platform/api/v1/accounts/${accountId}/account_users`,
          {
            method: 'POST',
            headers: {
              'api_access_token': CHATWOOT_PLATFORM_TOKEN,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user_id: newUser.id,
              role: 'administrator'
            })
          }
        )

        if (addToAccountResponse.ok) {
          const accountUser = await addToAccountResponse.json()
          apiKey = accountUser.access_token || newUser.access_token
          console.log(`[Chatwoot Create Account] User added to account ${accountId}`)
        }
      }
    }

    // If still no API key, try to get it from account
    if (!apiKey) {
      // Get API key from account settings
      const accountDetailsResponse = await fetch(
        `${CHATWOOT_API_URL}/platform/api/v1/accounts/${accountId}`,
        {
          headers: {
            'api_access_token': CHATWOOT_PLATFORM_TOKEN
          }
        }
      )

      if (accountDetailsResponse.ok) {
        const details = await accountDetailsResponse.json()
        apiKey = details.api_key || details.access_token
      }
    }

    if (!apiKey) {
      console.warn(`[Chatwoot Create Account] Could not obtain API key for account ${accountId}`)
      // Continue without API key - it can be set manually later
    }

    return NextResponse.json({
      success: true,
      chatwoot_account_id: accountId,
      chatwoot_api_key: apiKey
    })

  } catch (error) {
    console.error('[Chatwoot Create Account] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error creating Chatwoot account' },
      { status: 500 }
    )
  }
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}
