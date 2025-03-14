import { NextApiRequest, NextApiResponse } from 'next';
import { getSignedUrl } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

// Initialize Prisma client with Neon adapter - using edge-compatible initialization
const sql = neon(process.env.DATABASE_URL!);
const adapter = new PrismaNeonHTTP(sql);
// @ts-ignore - Prisma doesn't have proper edge types yet
const prisma = new PrismaClient({ adapter }).$extends({
  query: {
    $allOperations({ operation, args, query }) {
      return query(args);
    },
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, blobUrl, pageSlug } = req.body;

    if (!walletAddress || !blobUrl || !pageSlug) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!HELIUS_API_KEY) {
      console.error('Missing Helius API key');
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Get page data to retrieve the connected token and required amount
    const page = await prisma.page.findUnique({
      where: { slug: pageSlug },
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const tokenAddress = page.connectedToken;
    
    // Default to 1 if not specified
    const requiredAmount = '1';

    if (!tokenAddress) {
      return res.status(400).json({ error: 'No token is connected to this page' });
    }

    // Verify token holdings
    const verificationResult = await verifyTokenHoldings(walletAddress, tokenAddress, requiredAmount);
    
    if (!verificationResult.hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: `Insufficient token balance. Required: ${requiredAmount}, Current: ${verificationResult.balance}`,
        tokenSymbol: page.tokenSymbol || 'tokens'
      });
    }

    // If user has sufficient tokens, generate a signed URL for temporary access
    const signedUrl = await getSignedUrl(blobUrl, {
      expiresIn: 60 * 10, // URL expires in 10 minutes
    });

    return res.status(200).json({ 
      url: signedUrl,
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('Error accessing private content:', error);
    return res.status(500).json({ 
      error: 'Failed to access private content',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function verifyTokenHoldings(walletAddress: string, tokenAddress: string, requiredAmount: string) {
  try {
    // Use Helius RPC endpoint to get all assets
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'token-holdings',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 1000,
          displayOptions: {
            showFungible: true
          }
        }
      })
    });

    const data = await response.json();

    if (!data.result?.items) {
      return { 
        hasAccess: false,
        balance: '0'
      };
    }

    // Find the specific token we're looking for
    const tokenHolding = data.result.items
      .find((asset: any) => 
        (asset.id || asset.mint || asset.content?.metadata?.mint)?.toLowerCase() === tokenAddress.toLowerCase()
      );

    const balance = tokenHolding?.token_info?.balance || '0';
    const hasAccess = parseFloat(balance) >= parseFloat(requiredAmount);

    return { 
      hasAccess,
      balance
    };
  } catch (error) {
    console.error('Error verifying token access:', error);
    throw new Error('Failed to verify token holdings');
  }
} 