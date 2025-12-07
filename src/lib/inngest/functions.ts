import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";

// Helper: Generate embedding using OpenAI
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to generate embedding");
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Background job: Scrape user's network
export const scrapeNetwork = inngest.createFunction(
  { 
    id: "scrape-network",
    name: "Scrape X Network"
  },
  { event: "scrape/network.requested" },
  async ({ event, step }) => {
    const { userId, username, accessToken } = event.data;

    // Step 1: Fetch following from X API
    const following = await step.run("fetch-following", async () => {
      try {
        const response = await fetch(
          `https://api.twitter.com/2/users/${userId}/following?max_results=1000&user.fields=description,public_metrics,profile_image_url`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Twitter API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data || [];
      } catch (error) {
        console.error("Error fetching following:", error);
        return [];
      }
    });

    // Step 2: Save to Supabase
    await step.run("save-to-supabase", async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const profiles = following.map((user: any) => ({
        x_user_id: user.id,
        username: user.username,
        name: user.name,
        bio: user.description || "",
        profile_image_url: user.profile_image_url || "",
        verified: false,
        followers_count: user.public_metrics?.followers_count || 0,
        following_count: user.public_metrics?.following_count || 0,
        tweet_count: user.public_metrics?.tweet_count || 0,
        last_updated_at: new Date().toISOString(),
      }));
      
      // Upsert profiles
      const { error: profileError } = await supabase
        .from('x_profiles')
        .upsert(profiles, { onConflict: 'x_user_id' });
      
      if (profileError) {
        console.error("Error saving profiles:", profileError);
      }
      
      // Create connections (1st degree)
      const connections = following.map((user: any) => ({
        follower_id: userId,
        following_id: user.id,
        discovered_at: new Date().toISOString(),
      }));
      
      const { error: connectionError } = await supabase
        .from('x_connections')
        .upsert(connections, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
      
      if (connectionError) {
        console.error("Error saving connections:", connectionError);
      }
      
      return { count: following.length };
    });

    // Step 3: Trigger embedding generation
    await step.sendEvent("trigger-embeddings", {
      name: "embeddings/generate.requested",
      data: { 
        triggeredBy: username,
        reason: "network-scrape-completed"
      },
    });

    return { 
      success: true, 
      profilesScraped: following.length,
      username 
    };
  }
);

// Background job: Generate embeddings for profiles
export const generateEmbeddings = inngest.createFunction(
  { 
    id: "generate-embeddings",
    name: "Generate Profile Embeddings",
    retries: 3,
  },
  { event: "embeddings/generate.requested" },
  async ({ event, step }) => {
    let totalProcessed = 0;
    let hasMore = true;
    
    while (hasMore) {
      // Step: Process batch of 50 profiles
      const result = await step.run(`process-batch-${totalProcessed}`, async () => {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Get profiles without embeddings
        const { data: profiles, error: fetchError } = await supabase
          .from('x_profiles')
          .select('x_user_id, username, name, bio')
          .is('embedding', null)
          .limit(50);

        if (fetchError || !profiles || profiles.length === 0) {
          return { processed: 0, hasMore: false };
        }

        let processed = 0;
        
        // Generate embeddings for each profile
        for (const profile of profiles) {
          try {
            const searchText = [
              profile.name,
              profile.username,
              profile.bio || "",
            ].filter(Boolean).join(" ");

            const embedding = await generateEmbedding(searchText);

            // Update profile with embedding
            await supabase
              .from('x_profiles')
              .update({ embedding })
              .eq('x_user_id', profile.x_user_id);

            processed++;
            
            // Rate limit: 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Error processing ${profile.x_user_id}:`, error);
          }
        }

        return { 
          processed, 
          hasMore: profiles.length === 50 // If we got 50, there might be more
        };
      });

      totalProcessed += result.processed;
      hasMore = result.hasMore;

      // Add a small delay between batches
      if (hasMore) {
        await step.sleep("batch-delay", 1000); // 1 second between batches
      }
    }

    return {
      success: true,
      totalProcessed,
      message: `Generated embeddings for ${totalProcessed} profiles`,
    };
  }
);

// Optional: Cron job to auto-generate embeddings daily
export const autoGenerateEmbeddings = inngest.createFunction(
  { 
    id: "auto-generate-embeddings",
    name: "Auto Generate Embeddings (Daily)" 
  },
  { cron: "0 2 * * *" }, // Run at 2 AM every day
  async ({ step }) => {
    // Trigger the embedding generation
    await step.sendEvent("trigger-embeddings", {
      name: "embeddings/generate.requested",
      data: { 
        triggeredBy: "cron",
        reason: "scheduled-auto-generation"
      },
    });

    return { success: true, message: "Embedding generation triggered" };
  }
);
