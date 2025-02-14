import { LinkType } from '@/lib/links';
import { ThemeStyle } from '@/lib/themes';

export interface PageItem {
  id: string;
  type: LinkType;
  url?: string;
  title?: string;
  order: number;
  isPlugin?: boolean;
  tokenGated?: boolean;
  requiredTokens?: string[];
}

export interface PageData {
  walletAddress: string;
  createdAt: string;
  title?: string;
  description?: string;
  items?: PageItem[];
  updatedAt?: string;
  image?: string;
  slug: string;
  connectedToken?: string;
  tokenSymbol?: string;
  showToken?: boolean;
  showSymbol?: boolean;
  designStyle?: ThemeStyle;
  fonts?: {
    global?: string;
    heading?: string;
    paragraph?: string;
    links?: string;
  };
} 