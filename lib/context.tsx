import { createContext, useContext, useState, useEffect } from 'react';
import { usePrivy, WalletWithMetadata } from '@privy-io/react-auth';
import { PageData } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface TokenHolding {
  tokenAddress: string;
  balance: string;
}

interface SolanaWallet extends WalletWithMetadata {
  type: "wallet";
  chainType: "solana";
  address: string;
}

const isSolanaWallet = (account: any): account is SolanaWallet => {
  return account.type === "wallet" && account.chainType === "solana";
};

interface GlobalContextType {
  userPages: PageData[];
  tokenHoldings: TokenHolding[];
  isLoadingPages: boolean;
  isLoadingTokens: boolean;
  refreshPages: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  walletAddress?: string;
  isAuthenticated: boolean;
  error?: string;
  hasPageTokenAccess: boolean;
}

const GlobalContext = createContext<GlobalContextType>({
  userPages: [],
  tokenHoldings: [],
  isLoadingPages: false,
  isLoadingTokens: false,
  refreshPages: async () => {},
  refreshTokens: async () => {},
  walletAddress: undefined,
  isAuthenticated: false,
  hasPageTokenAccess: false,
});

export const useGlobalContext = () => useContext(GlobalContext);

export function GlobalProvider({ 
  children 
}: { 
  children: React.ReactNode;
}) {
  const { authenticated, user, ready } = usePrivy();
  const { toast } = useToast();
  const [userPages, setUserPages] = useState<PageData[]>([]);
  const [tokenHoldings, setTokenHoldings] = useState<TokenHolding[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [error, setError] = useState<string>();
  const [hasPageTokenAccess, setHasPageTokenAccess] = useState(false);

  // Get the first Solana wallet if one exists
  const walletAddress = user?.linkedAccounts?.find(isSolanaWallet)?.address;

  const fetchPages = async () => {
    if (!walletAddress || !authenticated) {
      setUserPages([]);
      return;
    }

    setIsLoadingPages(true);
    setError(undefined);
    
    try {
      const response = await fetch(`/api/page-store?walletAddress=${walletAddress}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch pages');
      }
      
      const { pages } = await response.json();
      
      // Sort pages by creation time (newest first)
      const sortedPages = (pages || []).sort((a: PageData, b: PageData) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      
      setUserPages(sortedPages);
    } catch (error) {
      console.error('Error fetching pages:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pages';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setUserPages([]);
    } finally {
      setIsLoadingPages(false);
    }
  };

  const fetchTokens = async () => {
    if (!walletAddress || !authenticated) {
      setTokenHoldings([]);
      setHasPageTokenAccess(false);
      return;
    }

    setIsLoadingTokens(true);
    try {
      const response = await fetch(`/api/token-holdings?walletAddress=${walletAddress}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch token holdings');
      }
      
      const { tokens } = await response.json();
      setTokenHoldings(tokens || []);

      // Check if user has enough PAGE_DOT_FUN_TOKEN tokens
      const pageDotFunToken = process.env.NEXT_PUBLIC_PAGE_DOT_FUN_TOKEN;
      if (!pageDotFunToken) {
        console.error('PAGE_DOT_FUN_TOKEN not configured');
        setHasPageTokenAccess(false);
        return;
      }

      const tokenHolding = tokens?.find((t: TokenHolding) => 
        t.tokenAddress.toLowerCase() === pageDotFunToken.toLowerCase()
      );

      if (!tokenHolding) {
        // User doesn't have the token at all
        setHasPageTokenAccess(false);
        return;
      }
        
      // Check if user has required amount of tokens
      const requiredHolding = process.env.NEXT_PUBLIC_PAGE_DOT_FUN_TOKEN_REQUIRED_HOLDING;
      const hasEnoughTokens = parseFloat(tokenHolding.balance) >= parseFloat(requiredHolding || "100000");
      setHasPageTokenAccess(hasEnoughTokens);
    } catch (error) {
      console.error('Error fetching token holdings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch token holdings';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setTokenHoldings([]);
      setHasPageTokenAccess(false);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Only fetch data when Privy is ready and user is authenticated
  useEffect(() => {
    if (ready && authenticated && walletAddress) {
      fetchPages();
      fetchTokens();
    }
  }, [ready, walletAddress, authenticated]);

  return (
    <GlobalContext.Provider 
      value={{
        userPages,
        tokenHoldings,
        isLoadingPages,
        isLoadingTokens,
        refreshPages: fetchPages,
        refreshTokens: fetchTokens,
        walletAddress,
        isAuthenticated: authenticated,
        error,
        hasPageTokenAccess,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
} 