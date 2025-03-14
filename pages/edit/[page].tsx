import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { PrivyClient } from "@privy-io/server-auth";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { isSolanaWallet } from "@/utils/wallet";
import { GOOGLE_FONTS } from "@/lib/fonts";
import { PageData, PageItem } from "@/types";
import { validateLinkUrl } from "@/lib/links";
import { LINK_PRESETS } from "@/lib/linkPresets";
import { themes } from "@/lib/themes";
import EditPageContent from "@/components/EditPageContent";
import { LinkSettingsDrawer } from "@/components/LinkSettingsDrawer";
import { LinksDrawer } from "@/components/drawers/LinksDrawer";
import { GeneralSettingsDrawer } from "@/components/drawers/GeneralSettingsDrawer";
import { DesignDrawer } from "@/components/drawers/DesignDrawer";
import { useThemeStyles } from '@/hooks/use-theme-styles';
import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';
import { neon, neonConfig } from '@neondatabase/serverless';
import { decryptUrl, isEncryptedUrl } from '@/lib/encryption';
import { Navbar } from "@/components/Navbar";
import { PublishBar } from "@/components/PublishBar";

// Configure neon to use fetch
neonConfig.fetchConnectionCache = true;

// Initialize Prisma client with Neon adapter
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

interface PageProps {
  slug: string;
  pageData: PageData | null;
  error?: string;
}

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const privyClient = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!);

export const getServerSideProps: GetServerSideProps<PageProps> = async ({
  params,
  req,
}) => {
  const slug = params?.page as string;

  try {
    // Get page data from Prisma
    const pageData = await prisma.page.findUnique({
      where: { slug },
      include: {
        items: true,
      },
    });

    if (!pageData) {
      return {
        redirect: {
          destination: `/${slug}`,
          permanent: false,
        },
      };
    }

    // Check authentication
    const idToken = req.cookies["privy-id-token"];
    if (!idToken) {
      return {
        redirect: {
          destination: `/${slug}`,
          permanent: false,
        },
      };
    }

    try {
      const user = await privyClient.getUser({ idToken });
      
      // Check if the wallet is in user's linked accounts
      let isOwner = false;
      for (const account of user.linkedAccounts) {
        if (account.type === "wallet" && account.chainType === "solana") {
          const walletAccount = account as { address?: string };
          if (walletAccount.address?.toLowerCase() === pageData.walletAddress.toLowerCase()) {
            isOwner = true;
            break;
          }
        }
      }

      if (!isOwner) {
        return {
          redirect: {
            destination: `/${slug}`,
            permanent: false,
          },
        };
      }

      // Process the page data to match our PageData interface
      const processedData: PageData = {
        id: pageData.id,
        walletAddress: pageData.walletAddress,
        slug: pageData.slug,
        connectedToken: pageData.connectedToken || null,
        tokenSymbol: pageData.tokenSymbol || null,
        title: pageData.title || null,
        description: pageData.description || null,
        image: pageData.image || null,
        pageType: pageData.pageType || "personal",
        theme: pageData.theme || "default",
        themeFonts: pageData.themeFonts ? JSON.parse(pageData.themeFonts as string) : {
          global: null,
          heading: null,
          paragraph: null,
          links: null,
        },
        themeColors: pageData.themeColors ? JSON.parse(pageData.themeColors as string) : {
          primary: null,
          secondary: null,
          background: null,
          text: null,
        },
        items: pageData.items.map(item => {
          // Decrypt URL if it's encrypted
          let url = item.url;
          if (url && isEncryptedUrl(url)) {
            try {
              url = decryptUrl(url);
            } catch (error) {
              console.error('Failed to decrypt URL for item:', item.id, error);
              url = null;
            }
          }

          return {
            id: item.id,
            pageId: item.pageId,
            presetId: item.presetId,
            title: item.title,
            url: url || null,
            order: item.order || 0,
            tokenGated: item.tokenGated,
            requiredTokens: item.requiredTokens,
            customIcon: item.customIcon || null,
          };
        }),
        createdAt: pageData.createdAt.toISOString(),
        updatedAt: pageData.updatedAt.toISOString(),
      };

      // Log the processed data to verify token fields
      console.log('Server-side processed data:', {
        connectedToken: processedData.connectedToken,
        tokenSymbol: processedData.tokenSymbol,
      });

      return {
        props: {
          slug,
          pageData: processedData,
        },
      };

    } catch (error) {
      console.error("Auth verification error:", error);
      return {
        redirect: {
          destination: `/${slug}`,
          permanent: false,
        },
      };
    }
  } catch (error) {
    console.error("Error fetching page data:", error);
    return {
      redirect: {
        destination: `/${slug}`,
        permanent: false,
      },
    };
  }
};

export default function EditPage({ slug, pageData, error }: PageProps) {
  const router = useRouter();
  const { authenticated, user, linkWallet } = usePrivy();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [pageDetails, setPageDetails] = useState<PageData | null>(null);
  const [previewData, setPreviewData] = useState<PageData | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: string;
  }>({});
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [designDrawerOpen, setDesignDrawerOpen] = useState(false);
  const [linkSettingsDrawerOpen, setLinkSettingsDrawerOpen] = useState(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [linksDrawerOpen, setLinksDrawerOpen] = useState(false);
  const [focusField, setFocusField] = useState<'title' | 'description' | 'image'>();

  const { cssVariables, googleFontsUrl, themeConfig } = useThemeStyles(previewData);

  // Debug logging for initial pageData
  useEffect(() => {
    console.log('Initial pageData:', {
      connectedToken: pageData?.connectedToken,
      tokenSymbol: pageData?.tokenSymbol,
      fullPageData: pageData
    });
  }, [pageData]);

  // Debug logging for pageDetails state
  useEffect(() => {
    console.log('Current pageDetails state:', {
      connectedToken: pageDetails?.connectedToken,
      tokenSymbol: pageDetails?.tokenSymbol,
      fullPageDetails: pageDetails
    });
  }, [pageDetails]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsDrawerOpen(false);
        setLinkSettingsDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // Check ownership and redirect if not owner
  useEffect(() => {
    if (pageData && authenticated) {
      const solanaWallet = user?.linkedAccounts?.find(isSolanaWallet);
      const isOwner =
        solanaWallet?.address?.toLowerCase() ===
        pageData.walletAddress?.toLowerCase();

      if (!isOwner) {
        router.replace(`/${slug}`);
      }
    }
  }, [pageData, authenticated, user, slug, router]);

  // Initialize state after component mounts
  useEffect(() => {
    if (pageData) {
      const currentTheme = pageData.theme || 'default';
      const themePreset = themes[currentTheme];
      
      const fonts = {
        global: pageData.themeFonts?.global || themePreset?.fonts?.global || 'Inter',
        heading: pageData.themeFonts?.heading || themePreset?.fonts?.heading || 'Inter',
        paragraph: pageData.themeFonts?.paragraph || themePreset?.fonts?.paragraph || 'Inter',
        links: pageData.themeFonts?.links || themePreset?.fonts?.links || 'Inter',
      };

      const initialPageData: PageData = {
        ...pageData,
        theme: currentTheme,
        themeFonts: fonts,
        connectedToken: pageData.connectedToken || null,  // Ensure these are explicitly set
        tokenSymbol: pageData.tokenSymbol || null,
      };

      console.log('Setting initial page data:', initialPageData);
      setPageDetails(initialPageData);
      setPreviewData(initialPageData);
    }
  }, [pageData]);

  // Update preview data whenever pageDetails changes
  useEffect(() => {
    if (pageDetails) {
      const currentTheme = pageDetails.theme || 'default';
      const themePreset = themes[currentTheme];
      const defaultFonts = {
        global: themePreset?.fonts?.global || 'Inter',
        heading: themePreset?.fonts?.heading || 'Inter',
        paragraph: themePreset?.fonts?.paragraph || 'Inter',
        links: themePreset?.fonts?.links || 'Inter',
      };

      console.log('PageDetails updated, checking for custom icons:', 
        pageDetails.items?.map(item => ({
          id: item.id,
          title: item.title,
          customIcon: item.customIcon
        }))
      );

      setPreviewData({
        ...pageDetails,
        theme: currentTheme,
        themeFonts: {
          global: pageDetails.themeFonts?.global ?? defaultFonts.global,
          heading: pageDetails.themeFonts?.heading ?? defaultFonts.heading,
          paragraph: pageDetails.themeFonts?.paragraph ?? defaultFonts.paragraph,
          links: pageDetails.themeFonts?.links ?? defaultFonts.links,
        },
      });
    }
  }, [pageDetails]);

  const validateLinks = (items: PageItem[] = []): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    items.forEach((item) => {
      if (!item.presetId) {
        return;
      }

      const preset = LINK_PRESETS[item.presetId];
      if (!preset) {
        return;
      }

      // If URL is required but not provided
      if (preset.options?.requiresUrl && !item.url) {
        errors[item.id] = "URL is required";
        return;
      }

      // If URL is provided, validate it
      if (item.url) {
        const isValid = validateLinkUrl(item.url, item.presetId);
        if (!isValid) {
          errors[item.id] = `Invalid ${preset.title} URL format`;
        }
      }
    });

    return errors;
  };

  const handleSavePageDetails = async () => {
    if (!pageDetails) return;

    if (!authenticated) {
      toast({
        title: "Authentication required",
        description: "Please connect your wallet to save changes.",
        variant: "destructive",
      });
      return;
    }

    const solanaWallet = user?.linkedAccounts?.find(isSolanaWallet);
    if (!solanaWallet || solanaWallet.address?.toLowerCase() !== pageDetails.walletAddress.toLowerCase()) {
      toast({
        title: "Unauthorized",
        description: "You don't have permission to edit this page.",
        variant: "destructive",
      });
      return;
    }

    // Add detailed logging before validation
    console.log("About to validate items:", {
      items: pageDetails.items?.map((item) => ({
        id: item.id,
        presetId: item.presetId,
        url: item.url,
        title: item.title,
      })),
    });

    // Validate links before saving
    const validationErrors = validateLinks(pageDetails.items);
    if (Object.keys(validationErrors).length > 0) {
      console.log("Validation errors found:", {
        errors: validationErrors,
        items: pageDetails.items?.map((item) => ({
          id: item.id,
          presetId: item.presetId,
          title: item.title,
          url: item.url,
        })),
      });

      setValidationErrors(validationErrors);
      toast({
        title: "Validation Error",
        description:
          "Please fix the highlighted errors in your links before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Log the original items
      console.log("Original items:", pageDetails.items);

      const items = pageDetails.items?.map((item, index) => {
        const mappedItem = {
          id: item.id || `item-${index}`,
          presetId: item.presetId,
          title: item.title || "",
          url: item.url || "",
          order: typeof item.order === 'number' ? item.order : index,
          tokenGated: !!item.tokenGated,
          requiredTokens: item.requiredTokens || [],
          customIcon: item.customIcon || null,
        };

        // Log each mapped item
        console.log(`Mapped item ${index}:`, {
          original: item,
          mapped: mappedItem,
        });

        return mappedItem;
      });

      // Add detailed logging for the actual save request
      const savePayload = {
        slug,
        walletAddress: pageDetails.walletAddress,
        connectedToken: pageDetails.connectedToken,
        tokenSymbol: pageDetails.tokenSymbol,
        title: pageDetails.title,
        description: pageDetails.description,
        image: pageDetails.image,
        theme: pageDetails.theme || 'default',
        themeFonts: pageDetails.themeFonts || {
          global: null,
          heading: null,
          paragraph: null,
          links: null,
        },
        themeColors: pageDetails.themeColors || {
          primary: null,
          secondary: null,
          background: null,
          text: null,
        },
        items: items?.filter((item) => item.presetId),
      };
      console.log(
        "Sending save request with payload:",
        JSON.stringify(savePayload, null, 2)
      );

      const response = await fetch("/api/page-store", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(savePayload),
        credentials: "same-origin",
      });

      const data = await response.json();
      console.log("Save response:", data);

      if (!response.ok) {
        console.error("Save error details:", data);
        if (data.details) {
          // Log the full validation error details
          console.error("Validation error details:", data.details);
          throw new Error(
            `Validation error: ${JSON.stringify(data.details, null, 2)}`
          );
        }
        throw new Error(data.error || "Failed to save changes");
      }

      toast({
        title: "Changes saved",
        description: "Your page has been updated successfully.",
        action: (
          <ToastAction altText="View page" onClick={() => router.push(`/${slug}`)}>
            Go to page
          </ToastAction>
        ),
      });
    } catch (error) {
      console.error("Error saving page:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLink = () => {
    setLinksDrawerOpen(true);
  };

  const handleLinkClick = (itemId: string) => {
    setSelectedLinkId(itemId);
    setLinkSettingsDrawerOpen(true);
  };

  const handleItemsReorder = (newItems: PageItem[]) => {
    setPageDetails((prev) => (prev ? { ...prev, items: newItems } : null));
  };

  const selectedLink = selectedLinkId
    ? pageDetails?.items?.find((item) => item.id === selectedLinkId)
    : undefined;

  // Debug logging for selected link and drawer state
  useEffect(() => {
    if (linkSettingsDrawerOpen) {
      console.log('Link settings drawer opened with:', {
        selectedLink,
        pageDetails: {
          connectedToken: pageDetails?.connectedToken,
          tokenSymbol: pageDetails?.tokenSymbol
        }
      });
    }
  }, [linkSettingsDrawerOpen, selectedLink, pageDetails]);

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-semibold text-red-600">{error}</h1>
          <p className="mt-2 text-gray-600">
            The page &quot;{slug}&quot; could not be found.
          </p>
          <Button className="mt-4" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Check if user has permission to edit
  const solanaWallet = user?.linkedAccounts?.find(isSolanaWallet);
  const canEdit =
    authenticated && solanaWallet?.address === pageDetails?.walletAddress;

  return (
    <>
      <Head>
        <title>Edit {pageDetails?.title || slug} - Page.fun</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Load theme fonts */}
        {googleFontsUrl && (
          <link href={googleFontsUrl} rel="stylesheet" />
        )}
        {/* Load all available fonts for the font selector */}
        {GOOGLE_FONTS.length > 0 && (
          <link
            href={`https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS.map(
              (font) => font.replace(" ", "+")
            ).join("&family=")}&display=swap`}
            rel="stylesheet"
          />
        )}
        <style>{cssVariables}</style>
      </Head>

      <main className="min-h-screen min-h-[100dvh]">
        <PublishBar
          isSaving={isSaving}
          onSave={handleSavePageDetails}
        />

        {/* Main content */}
        {previewData && (
          <div className="pf-page">
            <EditPageContent
              pageData={previewData}
              items={previewData.items?.filter((item): item is PageItem => Boolean(item && item.id && item.presetId)) || []}
              themeStyle={themeConfig}
              onLinkClick={handleLinkClick}
              onTitleClick={() => {
                setFocusField('title');
                setSettingsDrawerOpen(true);
              }}
              onDescriptionClick={() => {
                setFocusField('description');
                setSettingsDrawerOpen(true);
              }}
              onImageClick={() => {
                setFocusField('image');
                setSettingsDrawerOpen(true);
              }}
              onItemsReorder={handleItemsReorder}
              validationErrors={validationErrors}
              onAddLinkClick={handleAddLink}
            />
          </div>
        )}

        <Navbar 
          onAddLinkClick={handleAddLink}
          onSettingsClick={() => setSettingsDrawerOpen(true)}
          onDesignClick={() => setDesignDrawerOpen(true)}
        />

        {/* General Settings Drawer */}
        <GeneralSettingsDrawer
          open={settingsDrawerOpen}
          onOpenChange={(open) => {
            setSettingsDrawerOpen(open);
            if (!open) setFocusField(undefined);
          }}
          pageDetails={pageDetails}
          setPageDetails={setPageDetails}
          focusField={focusField}
        />

        {/* Design Drawer */}
        <DesignDrawer
          open={designDrawerOpen}
          onOpenChange={setDesignDrawerOpen}
          pageDetails={pageDetails}
          setPageDetails={setPageDetails}
        />

        {/* Links Drawer */}
        <LinksDrawer
          pageDetails={pageDetails}
          setPageDetails={setPageDetails}
          open={linksDrawerOpen}
          onOpenChange={setLinksDrawerOpen}
          onLinkAdd={(linkId) => {
            setLinksDrawerOpen(false);
          }}
        />

        {/* Link Settings Drawer */}
        <LinkSettingsDrawer
          item={selectedLink}
          error={selectedLinkId ? validationErrors[selectedLinkId] : undefined}
          tokenSymbol={pageDetails?.tokenSymbol || undefined}
          pageDetails={pageDetails}
          setPageDetails={setPageDetails}
          open={linkSettingsDrawerOpen}
          onOpenChange={setLinkSettingsDrawerOpen}
          onDelete={() => {
            if (!selectedLinkId) return;
            
            const newErrors = { ...validationErrors };
            delete newErrors[selectedLinkId];
            setValidationErrors(newErrors);

            setPageDetails((prev) => ({
              ...prev!,
              items: prev!.items!.filter((i) => i.id !== selectedLinkId),
            }));
            setLinkSettingsDrawerOpen(false);
          }}
          onUrlChange={(url) => {
            if (!selectedLinkId) return;

            setPageDetails((prev) => {
              if (!prev?.items) return prev;

              const updatedItems = prev.items.map((i) =>
                i.id === selectedLinkId ? { ...i, url } : i
              );

              return {
                ...prev,
                items: updatedItems,
              };
            });
          }}
          onValidationChange={(itemId, error) => {
            setValidationErrors((prev) => {
              const newErrors = { ...prev };
              if (error) {
                newErrors[itemId] = error;
              } else {
                delete newErrors[itemId];
              }
              return newErrors;
            });
          }}
        />
      </main>
    </>
  );
}
